import { describe, expect, it } from 'bun:test';

import { createEntryFromPageRange } from './mapping';

describe('mapping', () => {
    describe('createEntryFromPageRange', () => {
        it('should not include to page', () => {
            const actual = createEntryFromPageRange(
                {
                    body: 'B',
                    collection: 2,
                    page: 3,
                    pp: 8,
                    volume: 4,
                } as any,
                '1',
                'T',
                '9',
            ) as any;

            expect(actual).toEqual({
                arabic: 'B',
                collection: 2,
                flags: 3,
                from: 3,
                index: 1,
                pp: 8,
                translation: 'T',
                translator: 9,
                volume: 4,
            });
        });

        it('should include to page with specific flag', () => {
            const actual = createEntryFromPageRange(
                {
                    body: 'B',
                    collection: 2,
                    end: 99,
                    page: 3,
                    pp: 8,
                    volume: 4,
                } as any,
                '1',
                'T',
                '9',
                88,
            ) as any;

            expect(actual).toEqual({
                arabic: 'B',
                collection: 2,
                flags: 88,
                from: 3,
                index: 1,
                pp: 8,
                to: 99,
                translation: 'T',
                translator: 9,
                volume: 4,
            });
        });
    });
});
