import {
    arabicNumeralToNumber,
    findLastPunctuation,
    isAllUppercase,
    makeDiacriticInsensitiveRegex,
    PATTERN_ENDS_WITH_PUNCTUATION,
    toTitleCase,
} from 'bitaboom';
import type { Line, Page } from 'shamela';
import { EntryType } from '@/api/entries.js';
import type { PatternOptions, Translation } from '@/types.js';
import type { EntriesContext } from './entryContext.js';
import { PATTERNS } from './textUtils.js';

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
export const captureNumericChapters = (ln: Line, page: Page, context: EntriesContext) => {
    if (ln.id) {
        const [, idx, txt] = ln.text.match(PATTERNS.MatchArabicNumericListItem) || [];

        if (txt) {
            context.addEntry({
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

export const captureMarkdownChapters = (ln: Line) => {
    if (!ln.id && ln.text.startsWith('#')) {
        ln.text = ln.text.slice(1);
        ln.id = '0';
    }
};

/**
 * Captures lines that start with "باب " (chapter) and assigns them an ID
 * @param ln - Line object to process
 */
export const capturePlainTextChapters = (ln: Line) => {
    if (!ln.id && (CHAPTER_REGEX.test(ln.text) || KITAB_REGEX.test(ln.text))) {
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
export const processChapter = (ln: Line, page: Page, context: EntriesContext) => {
    if (ln.id) {
        context.addEntry({
            arabic: ln.text,
            from: page.id,
            id: ln.id,
            type: getEntryType(ln.text),
        });

        return true;
    }
};

export const captureCommaSeparatedArabicNumericListItem = (ln: Line, page: Page, context: EntriesContext) => {
    const [, indexes, txt] = ln.text.match(/^((?:[\u0660-\u0669]+(?:، )?)+)\s?[-–—ـ](.*)/) || [];

    if (txt) {
        const numbers = indexes.split(/، ?/).filter(Boolean).map(arabicNumeralToNumber);
        context.addEntry({ arabic: txt.trim(), from: page.id, id: numbers.join(',') });
        return true;
    }
};

export const captureSquareBracketListItem = (ln: Line, page: Page, context: EntriesContext) => {
    const [, idx, arabic] = ln.text.match(/^\[([\u0660-\u0669]+)\]\s?(.*)/) || [];

    if (arabic) {
        context.addEntry({
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
export const processArabicNumericListItem =
    (firstPageWithIndex: number) => (ln: Line, page: Page, context: EntriesContext) => {
        const [, idx, txt] = ln.text.match(PATTERNS.MatchArabicNumericListItem) || [];

        if (txt && page.id >= firstPageWithIndex) {
            context.addEntry({ arabic: txt.trim(), from: page.id, index: arabicNumeralToNumber(idx) });
            return true;
        }
    };

export const processArabicLetterNumericListItem = (ln: Line, page: Page, context: EntriesContext) => {
    const [, idx, txt] = ln.text.match(/^[\u0621-\u064A\u0660-\u0669]+\s+([\u0660-\u0669]+)\s?[-–—ـ]\s*(.*)/) || [];

    if (txt) {
        context.addEntry({ arabic: txt.trim(), from: page.id, index: arabicNumeralToNumber(idx) });
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
export const processNumericListItem = (ln: Line, page: Page, context: EntriesContext) => {
    const [, idx, txt] = ln.text.match(PATTERNS.MatchNumericListItem) || [];

    if (txt) {
        context.addEntry({ arabic: txt.trim(), from: page.id, index: parseInt(idx, 10) });
        return true;
    }
};

export const usedTerms: Record<string, number> = {};

export const captureNewEntryByPattern = (pattern: RegExp) => (ln: Line, page: Page, context: EntriesContext) => {
    const [, txt] = ln.text.match(pattern) || [];

    if (txt) {
        usedTerms[txt] = (usedTerms[txt] || 0) + 1;

        context.addEntry({ arabic: txt.trim(), from: page.id });
        return true;
    }
};

export const captureNewEntryByPatternOptions = (pattern: RegExp, options: PatternOptions) => {
    return (ln: Line, page: Page, context: EntriesContext) => {
        const [, txt] = ln.text.match(pattern) || [];

        if (txt && (!options.minPage || page.id >= options.minPage)) {
            context.addEntry({ arabic: txt.trim(), from: page.id, type: options.type });
            return true;
        }
    };
};

export const captureNewEntryByPatternAndType = (pattern: RegExp, type: number) => {
    return captureNewEntryByPatternOptions(pattern, { type });
};

/**
 * Captures an entire page as a single entry when no recent entries exist
 * @param ln - Line object to process
 * @param entries - Array to add new entries to
 * @param page - Current page being processed
 * @returns True if the entire page was captured, undefined otherwise
 */
export const captureEntirePage = (ln: Line, page: Page, { lastEntry, addEntry }: EntriesContext) => {
    if (!lastEntry || page.id - lastEntry.from! > 1) {
        addEntry({ arabic: ln.text, from: page.id });
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
export const captureFirstLooseLeaf = (ln: Line, page: Page, { lastEntry, addEntry }: EntriesContext) => {
    if (!lastEntry) {
        // first item is a loose leaf page
        addEntry({ arabic: ln.text, from: page.id });
        return true;
    }
};

/**
 * Appends a line's text to the last entry's Arabic content
 * @param param0 - Destructured line object containing text
 * @param entries - Array of entries to modify
 */
export const appendLineToLastEntry = ({ text }: Line, page: Page, context: EntriesContext) => {
    const last = context.lastEntry!;
    last.fromEndIndex = last.arabic!.length;
    last.arabic = [last.arabic, text].filter(Boolean).join(context.separator);

    if (last.from !== page.id) {
        last.to = page.id;
    }

    return true;
};

export const startNewEntryIfLastEntryMatches =
    (pattern: RegExp) =>
    ({ text }: Line, page: Page, { lastEntry, addEntry }: EntriesContext) => {
        const last = lastEntry!.arabic!;

        if (pattern.test(last)) {
            addEntry({ arabic: text.trim(), from: page.id });
            return true;
        }
    };

/**
 * Appends content from a new page to the last entry, handling page breaks intelligently
 * @param ln - Line object to process
 * @param entries - Array of entries to modify
 * @param page - Current page being processed
 * @returns True if the content was appended or processed, undefined otherwise
 */
export const appendNewPageToLastEntry = (ln: Line, page: Page, context: EntriesContext) => {
    const lastEntry = context.lastEntry!;
    const diff = page.id - lastEntry.from!;

    if (diff >= 1) {
        const arabic = lastEntry.arabic!;

        if (PATTERN_ENDS_WITH_PUNCTUATION.test(arabic) || PATTERNS.EndsWithNumber.test(arabic)) {
            // last page ended with a punctuation no need to continue here, just make this page separate
            return captureEntirePage(ln, page, context);
        }

        let lastPeriodIndex = findLastPunctuation(ln.text);

        if (lastPeriodIndex === -1) {
            lastPeriodIndex = ln.text.length - 1;
        }

        const beforePunctuation = ln.text.slice(0, lastPeriodIndex + 1).trim();
        appendLineToLastEntry({ text: beforePunctuation }, page, context);

        lastEntry.to = page.id;

        const afterPunctuation = ln.text.slice(lastPeriodIndex + 1).trim();

        if (afterPunctuation) {
            context.addEntry({ arabic: afterPunctuation, from: page.id });
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
    const [, id, text] = line.match(/^([BCFTP]\d+[a-z]?)\s?[-–—ـ](.*)$/) || [];

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
