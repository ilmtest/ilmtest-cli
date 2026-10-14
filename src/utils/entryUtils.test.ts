import { describe, expect, it } from 'bun:test';

import { filterMatchedEntries, fixGaps, indexEntriesForLookup } from './entryUtils';

describe('entryUtils', () => {
    describe('indexEntriesForLookup', () => {
        it('should index the entry when just page is defined', () => {
            const entries = [{ from: 10 }] as any;
            const actual = indexEntriesForLookup(entries as any);

            expect(actual.indexToEntries).toBeEmptyObject();
            expect(actual.pageToEntries).toEqual({ 10: entries });

            expect(actual.pageToEntries['10'][0]).toBe(entries[0]); // equality check
        });

        it('should index the entry when just page with a to is defined', () => {
            const entries = [{ from: 10, to: 12 }] as any;
            const actual = indexEntriesForLookup(entries as any);

            expect(actual.pageToEntries).toEqual({ 10: entries, 11: entries, 12: entries });
        });

        it('should index the entry with index and page', () => {
            const entries = [
                { from: 10, index: 1 },
                { from: 11, index: 1 },
                { from: 11, index: 2 },
            ] as any;
            const actual = indexEntriesForLookup(entries as any);

            expect(actual.pageToEntries).toEqual({ 10: [entries[0]], 11: entries.slice(1) });
            expect(actual.indexToEntries).toEqual({ '1t0': entries.slice(0, 2), '2t0': entries.slice(2) });
        });

        it('should index the additional numbers found in the matn', () => {
            const entries = [
                {
                    arabic: `٥٩٠٨ - ٥٩٠٩ - حَدَّثَنِي عَمْرُو بْنُ عَلِيٍّ: حَدَّثَنَا مُعَاذُ بْنُ هَانِئٍ: حَدَّثَنَا هَمَّامٌ: حَدَّثَنَا قَتَادَةُ، عَنْ أَنَسِ بْنِ مَالِكٍ أَوْ عَنْ رَجُلٍ، عَنْ أَبِي هُرَيْرَةَ قَالَ: «كَانَ النَّبِيُّ ﷺ ضَخْمَ الْقَدَمَيْنِ حَسَنَ الْوَجْهِ لَمْ أَرَ بَعْدَهُ مِثْلَهُ» ٥٩١٠ - وَقَالَ هِشَامٌ عَنْ مَعْمَرٍ عَنْ قَتَادَةَ عَنْ أَنَسٍ: كَانَ النَّبِيُّ ﷺ شَثْنَ الْقَدَمَيْنِ وَالْكَفَّيْنِ. ٥٩١١ ٥٩١٢ - وَقَالَ أَبُو هِلَالٍ: حَدَّثَنَا قَتَادَةُ عَنْ أَنَسٍ أَوْ جَابِرِ بْنِ عَبْدِ اللهِ كَانَ النَّبِيُّ ﷺ ضَخْمَ الْكَفَّيْنِ وَالْقَدَمَيْنِ، لَمْ أَرَ بَعْدَهُ شَبَهًا لَهُ.`,
                    from: 1,
                    index: 5,
                },
            ] as any;
            const actual = indexEntriesForLookup(entries as any, { scanMatn: true });

            expect(actual.indexToEntries).toEqual({
                '5t0': entries,
                '5908t0': entries,
                '5909t0': entries,
                '5910t0': entries,
                '5911t0': entries,
                '5912t0': entries,
            });
        });
    });

    describe('fixGaps', () => {
        it('should not touch chapters', () => {
            const entries = [{ index: 1 }, { index: 99, type: 3 }, { index: 3 }];
            const actual = fixGaps(entries as any);
            expect(actual).toMatchObject(entries);
        });

        it('should fix the incorrect index', () => {
            const entries = [{ index: 1 }, { index: 99 }, { index: 3 }];
            const actual = fixGaps(entries as any);
            expect(actual).toMatchObject([{ index: 1 }, { index: 2 }, { index: 3 }]);
        });

        it('should fix the indices in between', () => {
            const entries = [{ index: 1 }, { index: 99 }, { index: 999 }, { index: 4 }];
            const actual = fixGaps(entries as any);
            expect(actual).toMatchObject([{ index: 1 }, { index: 2 }, { index: 3 }, { index: 4 }]);
        });

        it('should ignore the chapter in between and fix the incorrect ones', () => {
            const entries = [{ index: 1 }, { index: 99 }, { index: 22, type: 1 }, { index: 999 }, { index: 4 }];
            const actual = fixGaps(entries as any);
            expect(actual).toMatchObject([
                { index: 1 },
                { index: 2 },
                { index: 22, type: 1 },
                { index: 3 },
                { index: 4 },
            ]);
        });

        it('should fix missing indexes', () => {
            const entries = [{ index: 1 }, {}, { index: 3 }];
            const actual = fixGaps(entries as any);
            expect(actual).toMatchObject([{ index: 1 }, { index: 2 }, { index: 3 }]);
        });

        it('should ignore the chapters in between and fix the incorrect ones', () => {
            const entries = [
                { index: 1 },
                { index: 99 },
                { index: 22, type: 1 },
                { index: 23, type: 1 },
                { index: 999 },
                { index: 24, type: 1 },
                { index: 4 },
            ];
            const actual = fixGaps(entries as any);
            expect(actual).toMatchObject([
                { index: 1 },
                { index: 2 },
                { index: 22, type: 1 },
                { index: 23, type: 1 },
                { index: 3 },
                { index: 24, type: 1 },
                { index: 4 },
            ]);
        });

        it('should only start fixing from the first available index', () => {
            const entries = [{}, {}, { index: 1 }, { index: 999 }, { index: 24 }, { index: 4 }];
            const actual = fixGaps(entries as any);

            expect(actual).toMatchObject([{}, {}, { index: 1 }, { index: 2 }, { index: 3 }, { index: 4 }]);
        });

        it('should only start fixing from the first available index', () => {
            const entries = [{}, {}, { index: 1 }, { index: 999 }, { index: 24 }, { index: 4 }];
            const actual = fixGaps(entries as any);

            expect(actual).toMatchObject([{}, {}, { index: 1 }, { index: 2 }, { index: 3 }, { index: 4 }]);
        });

        it('should handle the subset that can be fixed since their diff is ONLY 1', () => {
            const entries = [{ index: 1 }, { index: 8 }, { index: 24 }, { index: 10 }];
            const actual = fixGaps(entries as any);

            expect(actual).toMatchObject([{ index: 1 }, { index: 8 }, { index: 9 }, { index: 10 }]);
        });
    });

    describe('filterMatchedEntries', () => {
        it('should remove due to common index', () => {
            const actual = filterMatchedEntries([{ from: 1, index: 1 }] as any, [{ from: 1, index: 1 }] as any);

            expect(actual).toBeEmpty();
        });

        it('should not remove due to differing index', () => {
            const actual = filterMatchedEntries([{ from: 1, index: 1 }] as any, [{ from: 1, index: 2 }] as any);

            expect(actual).toMatchObject([{ from: 1, index: 1 }]);
        });

        it('should match due to common matn', () => {
            const entries = [{ arabic: 'أَشْعَثُ عَنْ عَامِرٍ', from: 1 }];

            const actual = filterMatchedEntries(entries as any, [{ arabic: 'أَشْعَثُ عَنْ عَامِرٍ', from: 1 }] as any);

            expect(actual).toBeEmpty();
        });

        it('should not match due to differing matn', () => {
            const entries = [{ arabic: 'أَشْعَثُ عَنْ عَامِرٍ', from: 1 }];

            const actual = filterMatchedEntries(entries as any, [{ arabic: 'عَامِرٍ', from: 1 }] as any);

            expect(actual).toMatchObject(entries);
        });
    });
});
