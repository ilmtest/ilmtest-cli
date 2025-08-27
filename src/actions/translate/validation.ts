import type { Entry } from '../../api/entries.js';

import logger from '../../utils/logger.js';

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

export const validateIndices = (arabicIndices: string[], translationIndices: string[]) => {
    const arabicKeys = new Set(arabicIndices);
    return translationIndices.filter((index) => !arabicKeys.has(index));
};

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
        }
    }

    return result;
};

export const filterEntriesFromCoveredPages = (entries: Entry[], coveredPages: Set<number>) => {
    return entries.filter((e) => !coveredPages.has(e.from));
};
