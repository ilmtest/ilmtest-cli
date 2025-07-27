import type { Page } from '../../api/maktabah.js';
import type { PageRange } from './types.js';

import { createEntryFromPageRange } from './mapping.js';
import { validateIndices } from './validation.js';

const PATTERNS = {
    MatchNumericListItem: /^(\d+)\s?[-–—ـ](.*)/,
};

export const walkAndIndexPages = (pages: Page[], pattern = PATTERNS.MatchNumericListItem) => {
    const indexToMatn: Record<string, PageRange> = {};
    const indexToLines: Record<string, string[]> = {};

    let lastIndex = '';

    for (const page of pages) {
        page.body
            .split('\n')
            .filter((line) => line.trim())
            .forEach((line) => {
                const [, index, text] = line.match(pattern) || [];

                if (index && text && !indexToMatn[index]) {
                    indexToMatn[index] = { ...page };
                    indexToLines[index] = [text];
                    lastIndex = index;
                } else if (lastIndex) {
                    indexToLines[lastIndex].push(line.trim());

                    if (indexToMatn[lastIndex].page !== page.page) {
                        indexToMatn[lastIndex].end = page.page;
                    }
                }
            });
    }

    for (const [index, texts] of Object.entries(indexToLines)) {
        indexToMatn[index] = {
            ...indexToMatn[index],
            body: texts
                .map((t) => t.trim())
                .filter(Boolean)
                .join('\n'),
        };
    }

    return indexToMatn;
};

export const walkAndIndexLines = (lines: string[], pattern = PATTERNS.MatchNumericListItem) => {
    const indexToLines: Record<string, string[]> = {};

    let lastIndex = '';

    for (const line of lines) {
        const [, index, text] = line.match(pattern) || [];

        if (index && text && !indexToLines[index]) {
            indexToLines[index] = [text];
            lastIndex = index;
        } else if (lastIndex) {
            indexToLines[lastIndex].push(line.trim());
        }
    }

    const result: Record<string, string> = {};

    for (const [index, texts] of Object.entries(indexToLines)) {
        result[index] = texts.map((t) => t.trim()).join('\n');
    }

    return result;
};

export const walkAndMapPagesToEntries = (pages: Page[], translationLines: string[], translatorId: string) => {
    const indexToMatn = walkAndIndexPages(pages);
    const indexToTranslation = walkAndIndexLines(translationLines);

    validateIndices(Object.keys(indexToMatn), Object.keys(indexToTranslation));

    const entries = Object.entries(indexToTranslation).map(([index, translation]) => {
        const page = indexToMatn[index];
        return createEntryFromPageRange(page, index, translation, translatorId);
    });

    return entries;
};
