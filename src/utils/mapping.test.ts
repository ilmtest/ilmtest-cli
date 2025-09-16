import { describe, expect, it } from 'bun:test';
import { mapBookPagesToEntries } from './mapping';

describe('mapping', () => {
    describe('mapBookPagesToEntries', () => {
        it('should trim the text', () => {
            const actual = mapBookPagesToEntries([{ content: ' ١٧٥٩ - تميم بن نذير ', id: 1, page: 20, part: 10 }], {
                maxPagesPerEntry: 1,
            });

            expect(actual).toEqual([
                {
                    arabic: 'تميم بن نذير',
                    from: 1,
                    id: '1759',
                    index: 1759,
                    pp: 20,
                    volume: 10,
                },
            ]);
        });

        it('should capture plain-text chapters', () => {
            const actual = mapBookPagesToEntries([{ content: 'باب التاء', id: 1, page: 20, part: 10 }], {
                maxPagesPerEntry: 1,
            });

            expect(actual).toEqual([
                {
                    arabic: 'باب التاء',
                    from: 1,
                    id: 'C1',
                    pp: 20,
                    type: 3,
                    volume: 10,
                },
            ]);
        });

        it('should capture chapter spans', () => {
            const actual = mapBookPagesToEntries(
                [{ content: `<span data-type="title" id=toc-355> الحكم </span>`, id: 1, page: 20, part: 10 }],
                {
                    maxPagesPerEntry: 1,
                },
            );

            expect(actual).toEqual([
                {
                    arabic: 'الحكم',
                    from: 1,
                    id: 'C355',
                    pp: 20,
                    type: 3,
                    volume: 10,
                },
            ]);
        });

        it('should capture roman numeric item', () => {
            const actual = mapBookPagesToEntries([{ content: `1234 - Something`, id: 1, page: 20, part: 10 }], {
                maxPagesPerEntry: 1,
            });

            expect(actual).toEqual([
                {
                    arabic: 'Something',
                    from: 1,
                    id: '1234',
                    index: 1234,
                    pp: 20,
                    volume: 10,
                },
            ]);
        });

        it('should not capture anything if nothing matched', () => {
            const actual = mapBookPagesToEntries(
                [{ content: `Something\rSomething else`, id: 1, page: 20, part: 10 }],
                {
                    maxPagesPerEntry: 1,
                },
            );

            expect(actual).toBeEmpty();
        });

        it('should capture loose pages', () => {
            const actual = mapBookPagesToEntries(
                [
                    { content: `1 - Something`, id: 1, page: 1, part: 1 },
                    { content: `Something else`, id: 2, page: 2, part: 1 },
                ],
                {
                    maxPagesPerEntry: 1,
                },
            );

            expect(actual).toEqual([
                {
                    arabic: 'Something',
                    from: 1,
                    id: '1',
                    index: 1,
                    pp: 1,
                    volume: 1,
                },
                {
                    arabic: 'Something else',
                    from: 2,
                    id: 'P21',
                    pp: 2,
                    volume: 1,
                },
            ]);
        });

        it('should append to the previous page', () => {
            const actual = mapBookPagesToEntries(
                [
                    { content: `1 - Something`, id: 1, page: 1, part: 1 },
                    { content: `Something else`, id: 2, page: 2, part: 1 },
                ],
                {
                    maxPagesPerEntry: 2,
                },
            );

            expect(actual).toEqual([
                {
                    arabic: 'Something\nSomething else',
                    from: 1,
                    id: '1',
                    index: 1,
                    pp: 1,
                    to: 2,
                    volume: 1,
                },
            ]);
        });
    });
});
