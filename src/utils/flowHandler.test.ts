import { describe, expect, it } from 'bun:test';

import { captureCommaSeparatedArabicNumericListItem } from './flowHandlers';

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
});
