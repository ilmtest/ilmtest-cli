import { Page } from '@/api/maktabah.js';

import type { IndexingState, PageProcessor } from './types.js';

export const indexPages = (pages: Page[], processors: PageProcessor[]): Omit<IndexingState, 'lastIndex'> => {
    // Initialize the state
    const state: IndexingState = {
        indexToBab: {},
        indexToKitab: {},
        indexToMatn: {},
        lastIndex: '',
    };

    for (const page of pages) {
        let currentBody = page.body;

        for (const processor of processors) {
            const result = processor({ body: currentBody, page, state });

            // Update the body for the next processor in the chain
            currentBody = result.body;

            // If a processor signals to stop, we break and move to the next page.
            if (result.stopProcessing) {
                break;
            }
        }
    }

    const { indexToBab, indexToKitab, indexToMatn } = state;
    return { indexToBab, indexToKitab, indexToMatn };
};
