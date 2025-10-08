import { arabicNumeralToNumber, isAllUppercase, makeDiacriticInsensitiveRegex, toTitleCase } from 'bitaboom';
import type { Line, Page } from 'shamela';
import { type Entry, EntryType } from '@/api/entries.js';
import type { Translation } from '@/types.js';
import { findLastPunctuation, PATTERNS } from './textUtils.js';

const CHAPTER_REGEX = new RegExp(`^${makeDiacriticInsensitiveRegex('باب').source} `);
const KITAB_REGEX = new RegExp(`^${makeDiacriticInsensitiveRegex('كتاب').source} `);

/**
 * Trims whitespace from the beginning and end of a line's text
 * @param ln - Line object to trim
 */
export const trimLine = (ln: Line) => {
    ln.text = ln.text.trim();
};

/**
 * Removes ID from lines that match Arabic numeric list item pattern
 * @param ln - Line object to process
 */
export const flattenNumericChapters = (ln: Line) => {
    if (ln.id && PATTERNS.MatchArabicNumericListItem.test(ln.text)) {
        ln.id = undefined;
    }
};

const getEntryType = (text: string) => (KITAB_REGEX.test(text.trim()) ? EntryType.Book : EntryType.Chapter);

/**
 * Removes ID from lines that match Arabic numeric list item pattern
 * @param ln - Line object to process
 */
export const captureNumericChapters = (ln: Line, entries: Partial<Entry>[], page: Page) => {
    if (ln.id) {
        const [, idx, txt] = ln.text.match(PATTERNS.MatchArabicNumericListItem) || [];

        if (txt) {
            entries.push({
                arabic: txt.trim(),
                from: page.id,
                id: ln.id,
                index: arabicNumeralToNumber(idx),
                type: getEntryType(txt),
            });

            return true;
        }
    }
};

/**
 * Captures lines that start with "باب " (chapter) and assigns them an ID
 * @param ln - Line object to process
 */
export const capturePlainTextChapters = (ln: Line) => {
    if (!ln.id && CHAPTER_REGEX.test(ln.text)) {
        ln.id = '0';
    }
};

export const removeSquareBracketsFromTitles = (ln: Line) => {
    if (ln.id && /\[([^-]+?)\s*-\s*([^\]]+)\]/.test(ln.text)) {
        ln.text = ln.text.slice(1, -1);
    }
};

/**
 * Processes chapter lines by creating chapter entries
 * @param ln - Line object to process
 * @param entries - Array to add new entries to
 * @param page - Current page being processed
 * @returns True if a chapter was processed, undefined otherwise
 */
export const processChapter = (ln: Line, entries: Partial<Entry>[], page: Page) => {
    if (ln.id) {
        entries.push({
            arabic: ln.text,
            from: page.id,
            id: ln.id,
            type: getEntryType(ln.text),
        });

        return true;
    }
};

export const captureCommaSeparatedArabicNumericListItem = (ln: Line, entries: Partial<Entry>[], page: Page) => {
    const [, indexes, txt] = ln.text.match(/^((?:[\u0660-\u0669]+(?:، )?)+)\s?[-–—ـ](.*)/) || [];

    if (txt) {
        const numbers = indexes.split(/، ?/).filter(Boolean).map(arabicNumeralToNumber);

        entries.push({ arabic: txt.trim(), from: page.id, id: numbers.join(',') });
        return true;
    }
};

export const captureSquareBracketListItem = (ln: Line, entries: Partial<Entry>[], page: Page) => {
    const [, idx, arabic] = ln.text.match(/^\[([\u0660-\u0669]+)\]\s?(.*)/) || [];

    if (arabic) {
        entries.push({
            arabic,
            from: page.id,
            index: arabicNumeralToNumber(idx),
        });

        return true;
    }
};

/**
 * Processes Arabic numeric list items and creates corresponding entries
 * @param ln - Line object to process
 * @param entries - Array to add new entries to
 * @param page - Current page being processed
 * @returns True if an Arabic numeric list item was processed, undefined otherwise
 */
export const processArabicNumericListItem = (ln: Line, entries: Partial<Entry>[], page: Page) => {
    const [, idx, txt] = ln.text.match(PATTERNS.MatchArabicNumericListItem) || [];

    if (txt) {
        entries.push({ arabic: txt.trim(), from: page.id, index: arabicNumeralToNumber(idx) });
        return true;
    }
};

export const processArabicLetterNumericListItem = (ln: Line, entries: Partial<Entry>[], page: Page) => {
    const [, idx, txt] = ln.text.match(/^[\u0621-\u064A\u0660-\u0669]+\s+([\u0660-\u0669]+)\s?[-–—ـ]\s*(.*)/) || [];

    if (txt) {
        entries.push({ arabic: txt.trim(), from: page.id, index: arabicNumeralToNumber(idx) });
        return true;
    }
};

/**
 * Processes regular numeric list items and creates corresponding entries
 * @param ln - Line object to process
 * @param entries - Array to add new entries to
 * @param page - Current page being processed
 * @returns True if a numeric list item was processed, undefined otherwise
 */
export const processNumericListItem = (ln: Line, entries: Partial<Entry>[], page: Page) => {
    const [, idx, txt] = ln.text.match(PATTERNS.MatchNumericListItem) || [];

    if (txt) {
        entries.push({ arabic: txt.trim(), from: page.id, index: parseInt(idx, 10) });
        return true;
    }
};

export const captureNewEntryByPattern = (pattern: RegExp) => (ln: Line, entries: Partial<Entry>[], page: Page) => {
    const [, txt] = ln.text.match(pattern) || [];

    if (txt) {
        entries.push({ arabic: txt.trim(), from: page.id });
        return true;
    }
};

/**
 * Captures an entire page as a single entry when no recent entries exist
 * @param ln - Line object to process
 * @param entries - Array to add new entries to
 * @param page - Current page being processed
 * @returns True if the entire page was captured, undefined otherwise
 */
export const captureEntirePage = (ln: Line, entries: Partial<Entry>[], page: Page) => {
    const lastEntry = entries.at(-1);

    if (!lastEntry || page.id - lastEntry.from! >= 1) {
        entries.push({ arabic: ln.text, from: page.id });
        return true;
    }
};

/**
 * Captures the first loose leaf page as an entry when no entries exist yet
 * @param ln - Line object to process
 * @param entries - Array to add new entries to
 * @param page - Current page being processed
 * @returns True if the first loose leaf was captured, undefined otherwise
 */
export const captureFirstLooseLeaf = (ln: Line, entries: Partial<Entry>[], page: Page) => {
    const lastEntry = entries.at(-1);

    if (!lastEntry) {
        // first item is a loose leaf page
        entries.push({ arabic: ln.text, from: page.id });
        return true;
    }
};

/**
 * Appends a line's text to the last entry's Arabic content
 * @param param0 - Destructured line object containing text
 * @param entries - Array of entries to modify
 */
export const appendLineToLastEntry = ({ text }: Line, entries: Partial<Entry>[], page: Page, separator: string) => {
    const last = entries.at(-1)!;
    last.arabic = [last.arabic, text].filter(Boolean).join(separator);

    if (last.from !== page.id) {
        last.to = page.id;
    }
};

/**
 * Appends content from a new page to the last entry, handling page breaks intelligently
 * @param ln - Line object to process
 * @param entries - Array of entries to modify
 * @param page - Current page being processed
 * @returns True if the content was appended or processed, undefined otherwise
 */
export const appendNewPageToLastEntry = (ln: Line, entries: Partial<Entry>[], page: Page, separator: string) => {
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
        appendLineToLastEntry({ text: beforePunctuation }, entries, page, separator);

        lastEntry.to = page.id;

        const afterPunctuation = ln.text.slice(lastPeriodIndex + 1).trim();

        if (afterPunctuation) {
            entries.push({ arabic: afterPunctuation, from: page.id });
        }

        return true;
    }
};

/**
 * Processes a translation line and creates a translation entry
 * @param line - String line to process
 * @param translations - Array to add new translations to
 * @returns True if a translation was processed, undefined otherwise
 */
export const processTranslation = (line: string, translations: Translation[]) => {
    const [, id, text] = line.match(/^([BCNP]\d+)\s?[-–—ـ](.*)$/) || [];

    if (text) {
        translations.push({
            id,
            text: isAllUppercase(text) ? toTitleCase(text.trim()) : text.trim(),
        });

        return true;
    }
};

/**
 * Appends a line to the last translation's text content
 * @param line - String line to append
 * @param translations - Array of translations to modify
 * @returns Always returns true to indicate processing completion
 */
export const appendToLastTranslation = (line: string, translations: Translation[]) => {
    const last = translations.at(-1)!;
    last.text = [last.text, line.trim()].join('\n');

    return true;
};
