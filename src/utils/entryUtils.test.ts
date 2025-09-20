import { describe, expect, it } from 'bun:test';

import { indexEntriesForLookup } from './entryUtils';

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
    });
});
