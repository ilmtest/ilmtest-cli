import { describe, expect, it } from 'bun:test';
import { mapBookPagesToEntries } from './mapping';

describe('mapping', () => {
    describe('mapBookPagesToEntries', () => {
        describe('discrete', () => {
            it('should trim the text', () => {
                const actual = mapBookPagesToEntries([{ content: ' ١٧٥٩ - تميم بن نذير ', id: 1, page: 20, part: 10 }]);

                expect(actual).toEqual([
                    { arabic: 'تميم بن نذير', from: 1, id: '1759', index: 1759, pp: 20, volume: 10 },
                ]);
            });

            it('should capture plain-text chapters', () => {
                const actual = mapBookPagesToEntries([{ content: 'باب التاء', id: 1, page: 20, part: 10 }]);

                expect(actual).toEqual([{ arabic: 'باب التاء', from: 1, id: 'C1', pp: 20, type: 3, volume: 10 }]);
            });

            it('should capture chapter spans', () => {
                const actual = mapBookPagesToEntries([
                    { content: `<span data-type="title" id=toc-355> الحكم </span>`, id: 1, page: 20, part: 10 },
                ]);

                expect(actual).toEqual([{ arabic: 'الحكم', from: 1, id: 'C355', pp: 20, type: 3, volume: 10 }]);
            });

            it('should capture roman numeric item', () => {
                const actual = mapBookPagesToEntries([{ content: `1234 - Something`, id: 1, page: 20, part: 10 }], {});

                expect(actual).toEqual([{ arabic: 'Something', from: 1, id: '1234', index: 1234, pp: 20, volume: 10 }]);
            });

            it('should handle multiple narrations on the same page', () => {
                const actual = mapBookPagesToEntries([
                    { content: `22 - Something\n23 - Else`, id: 1, page: 20, part: 10 },
                ]);

                expect(actual).toEqual([
                    { arabic: 'Something', from: 1, id: '22', index: 22, pp: 20, volume: 10 },
                    { arabic: 'Else', from: 1, id: '23', index: 23, pp: 20, volume: 10 },
                ]);
            });

            it('should just capture the page as the first loose leaf', () => {
                const actual = mapBookPagesToEntries([
                    { content: `Something\rSomething else`, id: 1, page: 1, part: 1 },
                ]);

                expect(actual).toEqual([{ arabic: 'Something\nSomething else', from: 1, id: 'P11', pp: 1, volume: 1 }]);
            });

            it('should capture indexed then a loose page', () => {
                const actual = mapBookPagesToEntries([
                    { content: `1 - Something.`, id: 1, page: 1, part: 1 },
                    { content: `Something else.`, id: 2, page: 2, part: 1 },
                ]);

                expect(actual).toEqual([
                    { arabic: 'Something.', from: 1, id: '1', index: 1, pp: 1, volume: 1 },
                    { arabic: 'Something else.', from: 2, id: 'P21', pp: 2, volume: 1 },
                ]);
            });

            it('should capture index then loose page without punctuations', () => {
                const actual = mapBookPagesToEntries([
                    { content: `1 - Something`, id: 1, page: 1, part: 1 },
                    { content: `Something else`, id: 2, page: 2, part: 1 },
                ]);

                expect(actual).toEqual([
                    { arabic: 'Something', from: 1, id: '1', index: 1, pp: 1, volume: 1 },
                    { arabic: 'Something else', from: 2, id: 'P21', pp: 2, volume: 1 },
                ]);
            });

            it('should capture index then loose page with more than one line', () => {
                const actual = mapBookPagesToEntries([
                    { content: `1 - Something`, id: 1, page: 1, part: 1 },
                    { content: `Something else\rNext line`, id: 2, page: 2, part: 1 },
                ]);

                expect(actual).toEqual([
                    { arabic: 'Something', from: 1, id: '1', index: 1, pp: 1, volume: 1 },
                    { arabic: 'Something else\nNext line', from: 2, id: 'P21', pp: 2, volume: 1 },
                ]);
            });

            it('should capture index then loose page with more than one line then new page separately in a new entry', () => {
                const actual = mapBookPagesToEntries([
                    { content: `1 - Something`, id: 1, page: 1, part: 1 },
                    { content: `Something else\rNext line`, id: 2, page: 2, part: 1 },
                    { content: `New page`, id: 3, page: 3, part: 1 },
                ]);

                expect(actual).toEqual([
                    { arabic: 'Something', from: 1, id: '1', index: 1, pp: 1, volume: 1 },
                    { arabic: 'Something else\nNext line', from: 2, id: 'P21', pp: 2, volume: 1 },
                    { arabic: 'New page', from: 3, id: 'P31', pp: 3, volume: 1 },
                ]);
            });

            it('should handle the three pages', () => {
                const actual = mapBookPagesToEntries([
                    { content: `A`, id: 1, page: 1, part: 1 },
                    { content: `B. C`, id: 2, page: 2, part: 1 },
                    { content: `D`, id: 3, page: 3, part: 1 },
                ]);

                expect(actual).toEqual([
                    {
                        arabic: 'A',
                        from: 1,
                        id: 'P11',
                        pp: 1,
                        volume: 1,
                    },
                    {
                        arabic: 'B. C',
                        from: 2,
                        id: 'P21',
                        pp: 2,
                        volume: 1,
                    },
                    {
                        arabic: 'D',
                        from: 3,
                        id: 'P31',
                        pp: 3,
                        volume: 1,
                    },
                ]);
            });
        });

        describe('isMulti', () => {
            it('should be two separate pages since first ends with punctuation', () => {
                const actual = mapBookPagesToEntries(
                    [
                        { content: `Some text.`, id: 1, page: 1, part: 1 },
                        { content: `More text.`, id: 2, page: 2, part: 1 },
                    ],
                    { isContinuous: true },
                );

                expect(actual).toEqual([
                    {
                        arabic: 'Some text.',
                        from: 1,
                        id: 'P11',
                        pp: 1,
                        volume: 1,
                    },
                    {
                        arabic: 'More text.',
                        from: 2,
                        id: 'P21',
                        pp: 2,
                        volume: 1,
                    },
                ]);
            });

            it('should only create a new entry after the last punctuation sentence', () => {
                const actual = mapBookPagesToEntries(
                    [
                        {
                            content: `Something else.\rThis is the rest of the sentence.\rAfter that we have it`,
                            id: 1,
                            page: 1,
                            part: 1,
                        },
                        { content: `Another sentence. Rest of sentence`, id: 2, page: 2, part: 1 },
                    ],
                    { isContinuous: true },
                );

                console.log(actual);

                expect(actual).toEqual([
                    {
                        arabic: 'Something else.\nThis is the rest of the sentence.\nAfter that we have it\nAnother sentence.',
                        from: 1,
                        id: 'P11',
                        pp: 1,
                        to: 2,
                        volume: 1,
                    },
                    {
                        arabic: 'Rest of sentence',
                        from: 2,
                        id: 'P21',
                        pp: 2,
                        volume: 1,
                    },
                ]);
            });

            it('should handle the three pages with punctuation', () => {
                const actual = mapBookPagesToEntries(
                    [
                        { content: `A`, id: 1, pp: 1, volume: 1 },
                        { content: `B. C`, id: 2, pp: 2, volume: 1 },
                        { content: `D. E`, id: 3, pp: 3, volume: 1 },
                        { content: `F`, id: 4, pp: 4, volume: 1 },
                    ],
                    { captureTrailing: true, isContinuous: true },
                );

                expect(actual).toEqual([
                    {
                        arabic: 'A\nB.',
                        from: 1,
                        id: 'P11',
                        pp: 1,
                        to: 2,
                        volume: 1,
                    },
                    {
                        arabic: 'C\nD.',
                        from: 2,
                        id: 'P21',
                        pp: 2,
                        to: 3,
                        volume: 1,
                    },
                    {
                        arabic: 'E\nF',
                        from: 3,
                        id: 'P31',
                        pp: 3,
                        to: 4,
                        volume: 1,
                    },
                ]);
            });
        });
    });
});
