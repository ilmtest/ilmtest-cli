import { arabicNumeralToNumber } from 'bitaboom';
import type { ArabicEntry, ShamelaBook, ShamelaPage } from '@/types.js';
import { type Entry, EntryType } from '../api/entries.js';
import logger from './logger.js';
import { removeAllTags, sanitizeChapter } from './textUtils.js';

/**
 * Generates a unique key for an entry based on its index and type
 * @param e - Entry object with index and type properties
 * @returns String key in format "index t type"
 */
export const getEntryKey = (e: Pick<Entry, 'index' | 'type'>) => `${e.index}t${e.type || 0}`;

export const getVolumePageKey = (e: Pick<Entry, 'volume' | 'pp'>) => `${e.volume || 0}/${e.pp || 0}`;

/**
 * Indexes entries for efficient lookup by both entry key and page number
 * @param entries - Array of entries to index
 * @returns Object containing indexed entries by key and by page number
 */
export const indexEntriesForLookup = (entries: Entry[], { scanMatn = false } = {}) => {
    const indexToEntries: Record<string, Entry[]> = {};
    const pageToEntries: Record<number, Entry[]> = {};
    const volumePageToEntries: Record<string, Entry[]> = {};

    for (const entry of entries) {
        if (entry.index) {
            const key = getEntryKey(entry);
            indexToEntries[key] = (indexToEntries[key] || []).concat(entry);
        }

        const length = entry.to && entry.to !== entry.from ? entry.to : entry.from;

        for (let i = entry.from; i <= length; i++) {
            pageToEntries[i] = (pageToEntries[i] || []).concat(entry);
        }

        if (entry.volume && entry.pp) {
            const key = getVolumePageKey(entry);
            volumePageToEntries[key] = (volumePageToEntries[key] || []).concat(entry);
        }

        if (scanMatn && !entry.type) {
            Array.from(entry.arabic!.matchAll(/([\u0660-\u0669]+) -?/g)).forEach(([arabicNumber]) => {
                const index = arabicNumeralToNumber(arabicNumber);
                const key = getEntryKey({ index });
                indexToEntries[key] = (indexToEntries[key] || []).concat(entry);
            });
        }
    }

    return { indexToEntries, pageToEntries, volumePageToEntries };
};

/**
 * Validates that entry indices are sequential without gaps
 * Logs warnings for any gaps found in the sequence
 * @param entries - Array of entries to validate
 */
export const validateGaplessEntryIndices = (entries: Pick<Entry, 'index' | 'from'>[]) => {
    entries
        //.filter((e) => e.index)
        //.sort((a, b) => a.index! - b.index!)
        .forEach((e, i, arr) => {
            const diff = i > 0 && e.index! - arr[i - 1].index!;

            if (i > 0 && diff !== 1) {
                logger.warn(`#Gap found in ${e.index}, prev was ${arr[i - 1].index}, see page ${e.from}`);
            }
        });
};

/**
 * Attempts to fix gaps in entry index sequences by correcting middle elements
 * Only fixes if the correction would create a perfect sequential pattern
 * @param entries - Array of entries to fix gaps in
 * @returns New array with corrected entries (does not mutate original)
 */
export const fixGaps = (entries: Entry[]) => {
    if (entries.length < 3) {
        return; // Can't fix gaps with less than 3 elements
    }

    // Check each element (except first and last) to see if it needs fixing
    for (let i = 1; i < entries.length - 1; i++) {
        const prev = entries[i - 1];
        const current = entries[i].index!;
        const next = entries[i + 1].index!;

        // Check if current should be prev + 1 and next - 1
        const expectedValue = prev.index! + 1;

        // Only fix if:
        // 1. Current is not the expected sequential value
        // 2. The expected value would be exactly 1 less than next
        if (current !== expectedValue && expectedValue === next - 1) {
            logger.warn(`Autocorrected #${current} to #${expectedValue} on page ${entries[i].from}`);
            entries[i].index = expectedValue;
            entries[i].id = expectedValue.toString();
        }
    }
};

const NUMERIC_CHAPTER_REGEX = /\(([\u0660-\u0669]+)(?:\s+[^)]*)?[)] (.+)/;

const mapPageToChapter = (p: ShamelaPage): ArabicEntry | undefined => {
    const [, arabicNumber, text] = p.content.match(NUMERIC_CHAPTER_REGEX) || [];

    if (arabicNumber) {
        const arabic = sanitizeChapter(text);

        return {
            arabic,
            commentary: [arabic, p.footer ? sanitizeChapter(p.footer) : ''].join(' '),
            from: p.id,
            index: arabicNumeralToNumber(arabicNumber),
            pp: p.pp,
            type: EntryType.Chapter,
            volume: p.volume,
        };
    }
};

export const indexChaptersForLookup = (book: ShamelaBook) => {
    const chapterPageIds = new Set(book.titles.map((t) => t.page));

    const indexToChapters = book.pages
        .filter((p) => chapterPageIds.has(p.id))
        .map(({ content, ...p }) => ({
            ...p,
            content: removeAllTags(content).replace(/\r/g, ' '),
        }))
        .map(mapPageToChapter)
        .filter(Boolean)
        .reduce(
            (acc, e) => {
                const key = getEntryKey(e!);
                acc[key] = (acc[key] || []).concat(e!);

                return acc;
            },
            {} as Record<string, ArabicEntry[]>,
        );

    return indexToChapters;
};
