import { arabicNumeralToNumber, isAllUppercase, toTitleCase } from 'bitaboom';
import type { Page } from 'shamela';
import { type Entry, EntryType } from '@/api/entries.js';
import type { Translation } from '@/types.js';
import type { Line } from './shamelaUtils.js';
import { PATTERNS } from './textUtils.js';

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

export const captureTrailingEntry = (ln: Line, entries: Partial<Entry>[], page: Page, maxPagesPerEntry: number) => {
    const diff = page.id - entries.at(-1)!.from!;

    if (diff >= maxPagesPerEntry) {
        entries.push({ arabic: ln.text, from: page.id });

        return true;
    }
};

export const appendToLastEntry = (ln: Line, entries: Partial<Entry>[], page: Page) => {
    const last = entries.at(-1)!;
    const diff = page.id - last.from!;

    last.arabic = [last.arabic, ln.text].filter(Boolean).join('\n');

    if (diff > 0) {
        last.to = page.id;
    }

    return true;
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
