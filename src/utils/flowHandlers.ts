import { arabicNumeralToNumber, isAllUppercase, toTitleCase } from 'bitaboom';
import type { Page } from 'shamela';
import { type Entry, EntryType } from '@/api/entries.js';
import type { Translation } from '@/types.js';
import type { Line } from './shamelaUtils.js';
import { findLastPunctuation, PATTERNS } from './textUtils.js';

export const trimLine = (ln: Line) => {
    ln.text = ln.text.trim();
};

export const extractNumericChapters = (ln: Line) => {
    if (ln.id && PATTERNS.MatchArabicNumericListItem.test(ln.text)) {
        ln.id = undefined;
    }
};

export const extractRoundNumericChapters = (ln: Line, entries: Partial<Entry>[], page: Page) => {
    const [, idx] = ln.text.match(/^\(([\u0660-\u0669]+)\)$/) || [];

    if (idx) {
        entries.push({
            arabic: '',
            from: page.id,
            id: ln.id,
            index: arabicNumeralToNumber(idx),
        });

        return true;
    }
};

export const capturePlainTextChapters = (ln: Line) => {
    if (!ln.id && /^باب /.test(ln.text)) {
        ln.id = '0';
    }
};

export const processChapter = (ln: Line, entries: Partial<Entry>[], page: Page) => {
    if (ln.id) {
        entries.push({
            arabic: ln.text,
            from: page.id,
            id: ln.id,
            type: EntryType.Chapter,
        });

        return true;
    }
};

export const processArabicNumericListItem = (ln: Line, entries: Partial<Entry>[], page: Page) => {
    const [, idx, txt] = ln.text.match(PATTERNS.MatchArabicNumericListItem) || [];

    if (txt) {
        entries.push({ arabic: txt.trim(), from: page.id, index: arabicNumeralToNumber(idx) });
        return true;
    }
};

export const processNumericListItem = (ln: Line, entries: Partial<Entry>[], page: Page) => {
    const [, idx, txt] = ln.text.match(PATTERNS.MatchNumericListItem) || [];

    if (txt) {
        entries.push({ arabic: txt.trim(), from: page.id, index: parseInt(idx, 10) });
        return true;
    }
};

export const captureEntirePage = (ln: Line, entries: Partial<Entry>[], page: Page) => {
    const lastEntry = entries.at(-1);

    if (!lastEntry || page.id - lastEntry.from! >= 1) {
        entries.push({ arabic: ln.text, from: page.id });
        return true;
    }
};

export const captureFirstLooseLeaf = (ln: Line, entries: Partial<Entry>[], page: Page) => {
    const lastEntry = entries.at(-1);

    if (!lastEntry) {
        // first item is a loose leaf page
        entries.push({ arabic: ln.text, from: page.id });
        return true;
    }
};

export const appendLineToLastEntry = ({ text }: Line, entries: Partial<Entry>[]) => {
    const last = entries.at(-1)!;
    last.arabic = [last.arabic, text].filter(Boolean).join('\n');
};

export const appendNewPageToLastEntry = (ln: Line, entries: Partial<Entry>[], page: Page) => {
    const lastEntry = entries.at(-1)!;
    const diff = page.id - lastEntry.from!;

    if (diff >= 1) {
        const arabic = lastEntry.arabic!;

        if (PATTERNS.EndsWithPunctuation.test(arabic) || PATTERNS.EndsWithNumber.test(arabic)) {
            // last page ended with a punctuation no need to continue here, just make this page separate
            return captureEntirePage(ln, entries, page);
        }

        let lastPeriodIndex = findLastPunctuation(ln.text);

        if (lastPeriodIndex === -1) {
            lastPeriodIndex = ln.text.length - 1;
        }

        const beforePunctuation = ln.text.slice(0, lastPeriodIndex + 1).trim();
        appendLineToLastEntry({ text: beforePunctuation }, entries);

        lastEntry.to = page.id;

        const afterPunctuation = ln.text.slice(lastPeriodIndex + 1).trim();

        if (afterPunctuation) {
            entries.push({ arabic: afterPunctuation, from: page.id });
        }

        return true;
    }
};

export const processTranslation = (line: string, translations: Translation[]) => {
    const [, id, text] = line.match(/^([CP]?\d+)\s?[-–—ـ](.*)$/) || [];

    if (text) {
        translations.push({
            id,
            text: isAllUppercase(text) ? toTitleCase(text) : text,
        });

        return true;
    }
};

export const appendToLastTranslation = (line: string, translations: Translation[]) => {
    const last = translations.at(-1)!;
    last.text = [last.text, line].join('\n');

    return true;
};
