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
 * Attempts to fix gaps in entry index sequences by correcting middle elements while ignoring any items where the "type" property is defined.
 * Only fixes if the correction would create a perfect sequential pattern
 * @param entries - Array of entries to fix gaps in
 * @returns New array with corrected entries (does not mutate original)
 */
export const fixGaps = <T extends { index?: number; type?: any }>(entries: T[]) => {
    // Create shallow copy to avoid mutation
    const result = entries.map((e) => ({ ...e }));

    // Precompute prefix sum of non-type items for O(1) range queries
    const nonTypePrefix: number[] = [0];
    for (let i = 0; i < result.length; i++) {
        nonTypePrefix.push(nonTypePrefix[i] + (result[i].type === undefined ? 1 : 0));
    }

    // Find all "anchor" positions (items with defined index and no type)
    const anchors: number[] = [];
    for (let i = 0; i < result.length; i++) {
        if (result[i].index !== undefined && result[i].type === undefined) {
            anchors.push(i);
        }
    }

    if (anchors.length < 2) {
        return result;
    }

    // Process segments greedily from start to end
    let i = 0;
    while (i < anchors.length - 1) {
        const startPos = anchors[i];
        const startIndex = result[startPos].index!;

        let bestEndIdx = -1;

        // Find the furthest anchor that makes a valid segment
        for (let j = i + 1; j < anchors.length; j++) {
            const endPos = anchors[j];
            const endIndex = result[endPos].index!;

            // Count non-type items in segment using prefix sum: O(1)
            const nonTypeCount = nonTypePrefix[endPos + 1] - nonTypePrefix[startPos];

            // Check if this segment is fixable
            if (endIndex - startIndex === nonTypeCount - 1) {
                bestEndIdx = j;
            }
        }

        // If we found a fixable segment, fix it
        if (bestEndIdx !== -1) {
            const endPos = anchors[bestEndIdx];
            let expectedIndex = startIndex;

            for (let k = startPos; k <= endPos; k++) {
                if (result[k].type === undefined) {
                    result[k].index = expectedIndex++;
                }
            }

            // Move to the end of the fixed segment
            i = bestEndIdx;
        } else {
            // No fixable segment from this anchor, move to next
            i++;
        }
    }

    return result;
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
