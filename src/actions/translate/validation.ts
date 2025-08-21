import type { Entry } from '../../api/entries.js';

import logger from '../../utils/logger.js';

export const validateGaplessEntryIndices = (entries: Entry[]) => {
    entries
        .filter((e) => e.index)
        .sort((a, b) => a.index! - b.index!)
        .forEach((e, i, arr) => {
            const diff = i > 0 && e.index! - arr[i - 1].index!;

            if (i > 0 && diff !== 1) {
                logger.warn(`#Gap found in ${e.index}`);
            }
        });
};

export const validateIndices = (arabicIndices: string[], translationIndices: string[]) => {
    const arabicKeys = new Set(arabicIndices);
    return translationIndices.filter((index) => !arabicKeys.has(index));
};
