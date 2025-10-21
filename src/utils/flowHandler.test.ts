import { describe, expect, it } from 'bun:test';

import {
    captureCommaSeparatedArabicNumericListItem,
    captureSquareBracketListItem,
    startNewEntryIfLastEntryMatches,
} from './flowHandlers';

describe('flowHandlers', () => {
    describe('captureCommaSeparatedArabicNumericListItem', () => {
        it('should start the entry', () => {
            const entries = [];
            captureCommaSeparatedArabicNumericListItem({ text: '٦٩، ٧٠ - قال' }, entries, {
                content: 'C',
                id: 1,
            });

            expect(entries).toMatchObject([
                {
                    arabic: 'قال',
                    from: 1,
                    id: '69,70',
                },
            ]);
        });

        it('should capture 4 entries', () => {
            const entries = [];
            captureCommaSeparatedArabicNumericListItem({ text: '١٢١٩، ١٢٢٠، ١٢٢١، ١٢٢٢ - قال أبو داود' }, entries, {
                content: 'C',
                id: 1,
            });

            expect(entries).toMatchObject([
                {
                    arabic: 'قال أبو داود',
                    from: 1,
                    id: '1219,1220,1221,1222',
                },
            ]);
        });
    });

    describe('captureSquareBracketListItem', () => {
        it('should capture the square list item', () => {
            const entries = [];
            captureSquareBracketListItem({ text: '[٩٩] "إبراهيم" بن حرب' }, entries, {
                content: 'C',
                id: 1,
            });

            expect(entries).toMatchObject([
                {
                    arabic: '"إبراهيم" بن حرب',
                    from: 1,
                    index: 99,
                },
            ]);
        });
    });

    describe('startNewEntryIfLastEntryMatches', () => {
        it('should start a new entry', () => {
            const entries = [{ arabic: 'The quick' }];

            const fn = startNewEntryIfLastEntryMatches(/quick$/);

            fn({ text: 'Line' }, entries, { content: 'C', id: 1 });

            expect(entries).toMatchObject([
                {
                    arabic: 'The quick',
                },
                {
                    arabic: 'Line',
                    from: 1,
                },
            ]);
        });
    });
});
