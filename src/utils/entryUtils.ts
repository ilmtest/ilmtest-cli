import { findMatches, findMatchesAll } from 'baburchi';
import { arabicNumeralToNumber } from 'bitaboom';
import type { ArabicEntry, ShamelaBook, ShamelaPage } from '@/types.js';
import { type Entry, EntryType } from '../api/entries.js';
import logger from './logger.js';
import { findLastPunctuation, removeAllTags, sanitizeChapter } from './textUtils.js';

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

        if (!entry.from) {
            logger.warn(`Entry ${entry.id} is unlinked...`);
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
export const fixGapsLegacy = (entries: Entry[]) => {
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

export const filterEntriesOnUsedPages = (entries: Entry[], coveredPages: Set<number>) => {
    const result = entries
        .filter((e) => !coveredPages.has(e.from!))
        .map((e) => {
            if (e.to && coveredPages.has(e.to) && e.fromEndIndex) {
                const { to, arabic, fromEndIndex, ...entry } = e;
                const text = arabic!.substring(0, fromEndIndex);
                return { ...entry, arabic: text.slice(0, findLastPunctuation(text) + 1).trim() };
            }

            return e;
        })
        .filter((e) => e.arabic);

    return result;
};

/**
 * Filters out from entries all the ones that are already processed
 * @param existing
 * @param entries
 */
export const filterMatchedEntries = (entries: Entry[], existing: Entry[]) => {
    const { pageToEntries } = indexEntriesForLookup(existing);

    return entries.filter((e) => {
        const entriesOnPage = pageToEntries[e.from];

        if (!entriesOnPage) {
            return true;
        }

        if (e.index) {
            const key = getEntryKey(e);
            return !entriesOnPage.some((ep) => getEntryKey(ep) === key);
        }

        const [matchedIndex] = findMatches(
            entriesOnPage.map((a) => a.arabic!),
            [e.arabic!],
        );

        return matchedIndex === -1;
    });
};

export const validateUniqueIds = (entries: Entry[]) => {
    const idToEntries = Object.groupBy(
        entries.filter((e) => e.id),
        (e) => e.id!,
    );

    Object.keys(idToEntries).forEach((id) => {
        const values = idToEntries[id]!;

        values.slice(1).forEach((v) => {
            logger.warn(`Turning: ${v.id} into ${v.id}${v.from}`);
            v.id = `${v.id}${v.from}`;
        });
    });
};
