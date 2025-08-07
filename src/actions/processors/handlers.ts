import { stripDiacritics } from 'bitaboom';

import { PageProcessor } from './types.js';

// A processor for "Kitab" titles. It finds a match, updates the index, and stops further processing on that page.
export const createKitabProcessor = (pattern: RegExp): PageProcessor => {
    return ({ body, page, state }) => {
        if (state.lastIndex && pattern.test(stripDiacritics(body))) {
            state.indexToKitab[state.lastIndex] = page;
            return { body, stopProcessing: true }; // Stop, this page is just a title
        }
        return { body, stopProcessing: false }; // No match, continue
    };
};

// A processor for "Bab" titles that consumes the title and passes the rest of the body along.
// This version includes the special logic for sub-chapters (lastIndex += '.').
export const createComplexBabProcessor = (pattern: RegExp): PageProcessor => {
    return ({ body, page, state }) => {
        // We use 's' flag in the pattern to ensure '.' matches newlines
        const match = body.match(pattern);

        if (state.lastIndex && match) {
            const [, babMatch, rest] = match;
            if (babMatch) {
                // This is the book-specific logic you wanted to isolate
                if (state.indexToBab[state.lastIndex]) {
                    state.lastIndex += '.';
                }
                state.indexToBab[state.lastIndex] = { ...page, body: babMatch.trim() };

                // Return the rest of the body for the next processor
                return { body: rest || '', stopProcessing: false };
            }
        }
        return { body, stopProcessing: false };
    };
};

// A processor for simple "Bab" titles that are expected to take up the whole page/section.
export const createSimpleBabProcessor = (pattern: RegExp): PageProcessor => {
    return ({ body, page, state }) => {
        const match = body.match(pattern);
        if (state.lastIndex && match) {
            const [babTitle] = match;

            if (state.indexToBab[state.lastIndex]) {
                state.lastIndex += '.';
            }

            state.indexToBab[state.lastIndex] = { ...page, body: babTitle.trim() };

            // Assume this title consumes the relevant part of the body
            const newBody = body.replace(pattern, '').trim();
            return { body: newBody, stopProcessing: false };
        }
        return { body, stopProcessing: false };
    };
};

// A processor that finds all numbered paragraphs ("Matn").
// This is typically the last processor in the chain.
export const createNumberedParagraphProcessor = (pattern: RegExp): PageProcessor => {
    return ({ body, page, state }) => {
        const matches = [...body.matchAll(pattern)];

        for (const [, index, text] of matches) {
            if (index && text && !state.indexToMatn[index]) {
                state.indexToMatn[index] = { ...page, body: text.trim() };
                // CRITICAL: It updates lastIndex for the *next* page's processors.
                state.lastIndex = index;
            }
        }
        // This processor doesn't consume the body, as it finds all matches.
        return { body, stopProcessing: false };
    };
};
