import type { Entry } from '../../api/entries.js';
import type { Page } from '../../api/maktabah.js';

import { convertArabicIndicToRoman } from '../../utils/textUtils.js';

export const PATTERNS = {
    BodyReferences: /\s?(?<!^)-?\[\d+\]\s?/, // [1]
    SquareBracketReferencesWithColon: /-\[\d+\]: /g, // "-[123]: "
    SquareBracketReferencesWithDash: /(?<!^)-\[\d+\]/g, // "-[123]",
};

const createPatch = (
    entry: Pick<Entry, 'id' | 'translation' | 'translator'>,
    patch: Pick<Entry, 'translation' | 'translator'>,
): Partial<Entry> => {
    return {
        flags: 4,
        id: entry.id,
        translation: [entry.translation, patch.translation].join('\n\n'),
        ...(!entry.translator && patch.translator && { translator: patch.translator }),
    };
};

export const sanitizePageBody = (page: Page) => {
    return {
        ...page,
        body: convertArabicIndicToRoman(page.body)
            .replace(PATTERNS.SquareBracketReferencesWithColon, '')
            .replace(PATTERNS.SquareBracketReferencesWithDash, ''),
    };
};

export function correctNumbering(arr: string[]): string[] {
    const result = [...arr];

    // Find all items that start with a number followed by " - "
    const numberedItems: { index: number; number: number }[] = [];

    for (let i = 0; i < arr.length; i++) {
        const match = arr[i].match(/^(\d+)\s*-\s*/);
        if (match) {
            numberedItems.push({
                index: i,
                number: parseInt(match[1]),
            });
        }
    }

    // If no numbered items found, return original array
    if (numberedItems.length === 0) {
        return result;
    }

    // For each pair of consecutive numbered items, check for gaps
    for (let i = 0; i < numberedItems.length - 1; i++) {
        const current = numberedItems[i];
        const next = numberedItems[i + 1];

        const expectedNext = current.number + 1;
        const actualNext = next.number;
        const gapSize = actualNext - expectedNext;

        // If there's a gap, fill in the missing numbers
        if (gapSize > 0) {
            const itemsInBetween = next.index - current.index - 1;

            // Only fill if we have enough items to fill the gap
            if (itemsInBetween >= gapSize) {
                let numberToAssign = expectedNext;

                // Go through items between current and next numbered items
                for (let j = current.index + 1; j < next.index && numberToAssign < actualNext; j++) {
                    // Only add numbers to items that don't already have them
                    const hasNumber = /^\d+\s*-\s*/.test(result[j]);
                    if (!hasNumber) {
                        result[j] = `${numberToAssign} - ${result[j]}`;
                        numberToAssign++;
                    }
                }
            }
        }
    }

    return result;
}

export const correctMissingIndices = (arr: Page[]) => {
    const result = [...arr];

    // Find all numbered items, including those with multiple numbers per element
    const numberedItems: { index: number; lineIndex?: number; number: number }[] = [];

    for (let i = 0; i < arr.length; i++) {
        const lines = arr[i].body.split(/\n/);

        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const match = lines[lineIndex].match(/^(\d+)\s*-\s*/);
            if (match) {
                numberedItems.push({
                    index: i,
                    lineIndex: lines.length > 1 ? lineIndex : undefined,
                    number: parseInt(match[1]),
                });
            }
        }
    }

    // If no numbered items found, return original array
    if (numberedItems.length === 0) {
        return result;
    }

    // For each pair of consecutive numbered items, check for gaps
    for (let i = 0; i < numberedItems.length - 1; i++) {
        const current = numberedItems[i];
        const next = numberedItems[i + 1];

        const expectedNext = current.number + 1;
        const actualNext = next.number;
        const gapSize = actualNext - expectedNext;

        // If there's a gap, fill in the missing numbers
        if (gapSize > 0) {
            // Calculate how many array elements are between the numbered items
            let itemsInBetween: number;

            if (current.index === next.index) {
                // Both numbers are in the same array element, no gap to fill
                continue;
            } else {
                itemsInBetween = next.index - current.index - 1;
            }

            // Only fill if we have enough items to fill the gap
            if (itemsInBetween >= gapSize) {
                let numberToAssign = expectedNext;

                // Go through items between current and next numbered items
                for (let j = current.index + 1; j < next.index && numberToAssign < actualNext; j++) {
                    // Only add numbers to items that don't already have them
                    const hasNumber = /^\d+\s*-\s*/.test(result[j].body) || /\n\d+\s*-\s*/.test(result[j].body);
                    if (!hasNumber) {
                        result[j].body = `${numberToAssign} - ${result[j]}`;
                        numberToAssign++;
                    }
                }
            }
        }
    }

    return result;
};

type MapEntriesToUpdatesOptions = {
    explains?: string;
    shouldMatchIndexWithAnyPage?: boolean;
    shouldSkipEntriesOnCoveredPages?: boolean;
    shouldUpdateArabic?: boolean;
    url?: string;
};

const getEntryKey = (e: Entry) => `${e.index}t${e.type || 0}`;

export const mapEntriesToUpdates = (
    entries: Entry[],
    indexToEntry: Record<string, Entry>,
    pageToEntries: Record<number, Entry[]>,
    {
        explains,
        shouldMatchIndexWithAnyPage,
        shouldSkipEntriesOnCoveredPages,
        shouldUpdateArabic,
        url,
    }: MapEntriesToUpdatesOptions,
) => {
    const newEntries: Entry[] = [];
    const entriesToUpdate: Partial<Entry>[] = [];

    if (shouldSkipEntriesOnCoveredPages) {
        entries = entries.filter((e) => !pageToEntries[e.from]);
    }

    entries.forEach((e) => {
        if (
            e.index &&
            indexToEntry[getEntryKey(e)] &&
            (shouldMatchIndexWithAnyPage || indexToEntry[getEntryKey(e)]?.from === e.from)
        ) {
            const patchedEntry = createPatch(indexToEntry[getEntryKey(e)], e);

            if (shouldUpdateArabic) {
                patchedEntry.arabic = e.arabic;
                patchedEntry.volume = e.volume;
                patchedEntry.from = e.from;
                patchedEntry.to = e.to;
                patchedEntry.pp = e.pp;
                patchedEntry.url = e.url;
            }

            entriesToUpdate.push(patchedEntry);
        } else if (!e.index && pageToEntries[e.from]?.some((existingEntry) => !existingEntry.index)) {
            // chapters which already exist
            const existing = pageToEntries[e.from].find((existingEntry) => !existingEntry.index)!;
            const patchedEntry = createPatch(existing, e);

            if (shouldUpdateArabic) {
                patchedEntry.arabic = e.arabic;
                patchedEntry.volume = e.volume;
                patchedEntry.from = e.from;
                patchedEntry.to = e.to;
                patchedEntry.pp = e.pp;
                patchedEntry.url = e.url;
            }

            entriesToUpdate.push(patchedEntry);
        } else {
            newEntries.push({ ...e, ...(explains && { explains: [explains] }), ...(url && { url }) } as Entry);
        }
    });

    return { entriesToUpdate, newEntries };
};

export const indexEntriesByNumber = (entries: Entry[]) => {
    const indexToEntry: Record<string, Entry> = {};
    const pageToEntries: Record<number, Entry[]> = {};

    for (const entry of entries) {
        if (entry.index) {
            indexToEntry[getEntryKey(entry)] = entry;
        }

        if (!pageToEntries[entry.from]) {
            pageToEntries[entry.from] = [];
        }

        pageToEntries[entry.from].push(entry);
    }

    return { indexToEntry, pageToEntries };
};
