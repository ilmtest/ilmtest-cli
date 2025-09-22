import type { Page } from '@/api/maktabah.js';

import type { Entry } from '../api/entries.js';
import logger from './logger.js';

/**
 * Generates a unique key for an entry based on its index and type
 * @param e - Entry object with index and type properties
 * @returns String key in format "index t type"
 */
export const getEntryKey = (e: Pick<Entry, 'index' | 'type'>) => `${e.index}t${e.type || 0}`;

/**
 * Indexes entries for efficient lookup by both entry key and page number
 * @param entries - Array of entries to index
 * @returns Object containing indexed entries by key and by page number
 */
export const indexEntriesForLookup = (entries: Entry[]) => {
    const indexToEntries: Record<string, Entry[]> = {};
    const pageToEntries: Record<number, Entry[]> = {};

    for (const entry of entries) {
        if (entry.index) {
            const key = getEntryKey(entry);
            indexToEntries[key] = (indexToEntries[key] || []).concat(entry);
        }

        const length = entry.to && entry.to !== entry.from ? entry.to : entry.from;

        for (let i = entry.from; i <= length; i++) {
            pageToEntries[i] = (pageToEntries[i] || []).concat(entry);
        }
    }

    return { indexToEntries, pageToEntries };
};

/**
 * Validates that entry indices are sequential without gaps
 * Logs warnings for any gaps found in the sequence
 * @param entries - Array of entries to validate
 */
export const validateGaplessEntryIndices = (entries: Entry[]) => {
    entries
        .filter((e) => e.index)
        .sort((a, b) => a.index! - b.index!)
        .forEach((e, i, arr) => {
            const diff = i > 0 && e.index! - arr[i - 1].index!;

            if (i > 0 && diff !== 1) {
                logger.warn(`#Gap found in ${e.index}, see page ${e.from}`);
            }
        });
};

/**
 * Validates translation indices against Arabic indices to find mismatches
 * @param arabicIndices - Array of Arabic text indices
 * @param translationIndices - Array of translation indices to validate
 * @returns Array of translation indices that don't have corresponding Arabic indices
 */
export const validateIndices = (arabicIndices: string[], translationIndices: string[]) => {
    const arabicKeys = new Set(arabicIndices);
    return translationIndices.filter((index) => !arabicKeys.has(index));
};

/**
 * Attempts to fix gaps in entry index sequences by correcting middle elements
 * Only fixes if the correction would create a perfect sequential pattern
 * @param entries - Array of entries to fix gaps in
 * @returns New array with corrected entries (does not mutate original)
 */
export const fixGaps = (entries: Entry[]) => {
    if (entries.length < 3) {
        return entries; // Can't fix gaps with less than 3 elements
    }

    const result = [...entries]; // Create a copy to avoid mutating the original

    // Check each element (except first and last) to see if it needs fixing
    for (let i = 1; i < result.length - 1; i++) {
        const prev = result[i - 1];
        const current = result[i].index!;
        const next = result[i + 1].index!;

        // Check if current should be prev + 1 and next - 1
        const expectedValue = prev.index! + 1;

        // Only fix if:
        // 1. Current is not the expected sequential value
        // 2. The expected value would be exactly 1 less than next
        if (current !== expectedValue && expectedValue === next - 1) {
            logger.warn(`Autocorrected #${current} to #${expectedValue} on page ${result[i].from}`);
            result[i].index = expectedValue;
            result[i].id = expectedValue.toString();
        }
    }

    return result;
};

/**
 * Corrects numbering gaps in an array of strings by adding missing sequential numbers
 * @param arr - Array of strings that may have numbered items with gaps
 * @returns New array with missing numbers filled in between existing numbered items
 */
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

/**
 * Corrects missing indices in page bodies by filling gaps in numbered sequences
 * @param arr - Array of pages that may have numbered content with gaps
 * @returns New array with missing numbers filled in the page bodies
 */
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
