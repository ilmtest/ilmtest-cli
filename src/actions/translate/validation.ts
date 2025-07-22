import type { Entry } from '../../api/entries.js';

import logger from '../../utils/logger.js';

export const validateGaplessEntryIndices = (entries: Entry[]) => {
    entries.forEach((e, i, arr) => {
        const diff = i > 0 && e.index! - arr[i - 1].index!;

        if (i > 0 && diff !== 1) {
            logger.error(`#Gap found in ${e.index}`);
        }
    });
};
