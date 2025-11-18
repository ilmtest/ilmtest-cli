import { describe, expect, it } from 'bun:test';
import { CAPTURE_CONTINUOUS_PAGES } from './constants';
import { mapLinesToTranslations, segmentPages } from './mapping';

describe('mapping', () => {
    describe('segmentPages', () => {
        describe('discrete', () => {
            it('should trim the text', () => {
                const actual = segmentPages([{ content: ' ١٧٥٩ - تميم بن نذير ', id: 1, pp: 20, volume: 10 }]);

                expect(actual).toEqual([
                    { arabic: 'تميم بن نذير', from: 1, id: 'N1759', index: 1759, pp: 20, volume: 10 },
                ]);
            });

            it('should capture plain-text chapters', () => {
                const actual = segmentPages([{ content: 'باب التاء', id: 1, pp: 20, volume: 10 }], {
                    shouldCapturePlainTextChapters: true,
                });

                expect(actual).toEqual([{ arabic: 'باب التاء', from: 1, id: 'C1', pp: 20, type: 2, volume: 10 }]);
            });

            it('should capture chapter spans', () => {
                const actual = segmentPages([
                    { content: `<span data-type="title" id=toc-355> الحكم </span>`, id: 1, pp: 20, volume: 10 },
                ]);

                expect(actual).toEqual([{ arabic: 'الحكم', from: 1, id: 'C355', pp: 20, type: 2, volume: 10 }]);
            });

            it('should capture roman numeric item', () => {
                const actual = segmentPages([{ content: `1234 - Something`, id: 1, pp: 20, volume: 10 }], {});

                expect(actual).toEqual([
                    { arabic: 'Something', from: 1, id: 'N1234', index: 1234, pp: 20, volume: 10 },
                ]);
            });

            it('should handle multiple narrations on the same page', () => {
                const actual = segmentPages([{ content: `22 - Something\n23 - Else`, id: 1, pp: 20, volume: 10 }]);

                expect(actual).toEqual([
                    { arabic: 'Something', from: 1, id: 'N22', index: 22, pp: 20, volume: 10 },
                    { arabic: 'Else', from: 1, id: 'N23', index: 23, pp: 20, volume: 10 },
                ]);
            });

            it('should just capture the page as the first loose leaf', () => {
                const actual = segmentPages([{ content: `Something\rSomething else`, id: 1, pp: 1, volume: 1 }]);

                expect(actual).toEqual([
                    { arabic: 'Something\nSomething else', from: 1, fromEndIndex: 9, id: 'P11', pp: 1, volume: 1 },
                ]);
            });

            it('should capture indexed then a loose page', () => {
                const actual = segmentPages([
                    { content: `1 - Something.`, id: 1, pp: 1, volume: 1 },
                    { content: `Something else.`, id: 2, pp: 2, volume: 1 },
                ]);

                expect(actual).toEqual([
                    { arabic: 'Something.', from: 1, id: 'N1', index: 1, pp: 1, volume: 1 },
                    { arabic: 'Something else.', from: 2, id: 'P21', pp: 2, volume: 1 },
                ]);
            });

            it('should capture index then loose page without punctuations', () => {
                const actual = segmentPages([
                    { content: `1 - Something`, id: 1, pp: 1, volume: 1 },
                    { content: `Something else`, id: 2, pp: 2, volume: 1 },
                ]);

                expect(actual).toEqual([
                    { arabic: 'Something', from: 1, id: 'N1', index: 1, pp: 1, volume: 1 },
                    { arabic: 'Something else', from: 2, id: 'P21', pp: 2, volume: 1 },
                ]);
            });

            it('should capture index then loose page with more than one line', () => {
                const actual = segmentPages([
                    { content: `1 - Something`, id: 1, pp: 1, volume: 1 },
                    { content: `Something else\rNext line`, id: 2, pp: 2, volume: 1 },
                ]);

                expect(actual).toEqual([
                    { arabic: 'Something', from: 1, id: 'N1', index: 1, pp: 1, volume: 1 },
                    { arabic: 'Something else\nNext line', from: 2, fromEndIndex: 14, id: 'P21', pp: 2, volume: 1 },
                ]);
            });

            it('should capture index then loose page with more than one line then new page separately in a new entry', () => {
                const actual = segmentPages([
                    { content: `1 - Something`, id: 1, pp: 1, volume: 1 },
                    { content: `Something else\rNext line`, id: 2, pp: 2, volume: 1 },
                    { content: `New page`, id: 3, pp: 3, volume: 1 },
                ]);

                expect(actual).toEqual([
                    { arabic: 'Something', from: 1, id: 'N1', index: 1, pp: 1, volume: 1 },
                    { arabic: 'Something else\nNext line', from: 2, fromEndIndex: 14, id: 'P21', pp: 2, volume: 1 },
                    { arabic: 'New page', from: 3, id: 'P31', pp: 3, volume: 1 },
                ]);
            });

            it('should handle the three pages', () => {
                const actual = segmentPages([
                    { content: `A`, id: 1, pp: 1, volume: 1 },
                    { content: `B. C`, id: 2, pp: 2, volume: 1 },
                    { content: `D`, id: 3, pp: 3, volume: 1 },
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

        describe('captureCommaSeparatedIndices', () => {
            it('should produce empty entries for the subsequent indices', () => {
                const actual = segmentPages(
                    [{ content: '١٢١٩، ١٢٢٠، ١٢٢١، ١٢٢٢ - قال أبو داود', id: 1, pp: 1, volume: 1 }],
                    {
                        captureCommaSeparatedIndices: true,
                    },
                );

                expect(actual).toMatchObject([
                    {
                        arabic: 'قال أبو داود',
                        from: 1,
                        id: 'N1219',
                        index: 1219,
                        pp: 1,
                        volume: 1,
                    },
                    {
                        arabic: '',
                        from: 1,
                        id: 'N1220',
                        index: 1220,
                        pp: 1,
                        volume: 1,
                    },
                    {
                        arabic: '',
                        from: 1,
                        id: 'N1221',
                        index: 1221,
                        pp: 1,
                        volume: 1,
                    },
                    {
                        arabic: '',
                        from: 1,
                        id: 'N1222',
                        index: 1222,
                        pp: 1,
                        volume: 1,
                    },
                ]);
            });
        });

        describe('isMulti', () => {
            it('should be two separate pages since first ends with punctuation', () => {
                const actual = segmentPages(
                    [
                        { content: `Some text.`, id: 1, pp: 1, volume: 1 },
                        { content: `More text.`, id: 2, pp: 2, volume: 1 },
                    ],
                    { pageSpanning: CAPTURE_CONTINUOUS_PAGES },
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

            it('should be a single spanning entry since we are not capturing trailing', () => {
                const actual = segmentPages(
                    [
                        { content: `Some text.`, id: 1, pp: 1, volume: 1 },
                        { content: `More text.`, id: 2, pp: 2, volume: 1 },
                    ],
                    { pageSpanning: 'true' },
                );

                expect(actual).toEqual([
                    {
                        arabic: 'Some text.\nMore text.',
                        from: 1,
                        fromEndIndex: 10,
                        id: 'P11',
                        pp: 1,
                        to: 2,
                        volume: 1,
                    },
                ]);
            });

            it('should only create a new entry after the last punctuation sentence', () => {
                const actual = segmentPages(
                    [
                        {
                            content: `Something else.\rThis is the rest of the sentence.\rAfter that we have it`,
                            id: 1,
                            pp: 1,
                            volume: 1,
                        },
                        { content: `Another sentence. Rest of sentence`, id: 2, pp: 2, volume: 1 },
                    ],
                    { pageSpanning: CAPTURE_CONTINUOUS_PAGES },
                );

                expect(actual).toEqual([
                    {
                        arabic: 'Something else.\nThis is the rest of the sentence.\nAfter that we have it\nAnother sentence.',
                        from: 1,
                        fromEndIndex: 71,
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
                const actual = segmentPages(
                    [
                        { content: `A`, id: 1, pp: 1, volume: 1 },
                        { content: `B. C`, id: 2, pp: 2, volume: 1 },
                        { content: `D. E`, id: 3, pp: 3, volume: 1 },
                        { content: `F`, id: 4, pp: 4, volume: 1 },
                    ],
                    { pageSpanning: CAPTURE_CONTINUOUS_PAGES },
                );

                expect(actual).toEqual([
                    {
                        arabic: 'A\nB.',
                        from: 1,
                        fromEndIndex: 1,
                        id: 'P11',
                        pp: 1,
                        to: 2,
                        volume: 1,
                    },
                    {
                        arabic: 'C\nD.',
                        from: 2,
                        fromEndIndex: 1,
                        id: 'P21',
                        pp: 2,
                        to: 3,
                        volume: 1,
                    },
                    {
                        arabic: 'E\nF',
                        from: 3,
                        fromEndIndex: 1,
                        id: 'P31',
                        pp: 3,
                        to: 4,
                        volume: 1,
                    },
                ]);
            });

            it('should handle the three pages with punctuation', () => {
                const actual = segmentPages(
                    [
                        { content: `A`, id: 1, pp: 1, volume: 1 },
                        { content: `B. C`, id: 2, pp: 2, volume: 1 },
                        { content: `D. E`, id: 3, pp: 3, volume: 1 },
                        { content: `F`, id: 4, pp: 4, volume: 1 },
                    ],
                    { pageSpanning: CAPTURE_CONTINUOUS_PAGES },
                );

                expect(actual).toEqual([
                    {
                        arabic: 'A\nB.',
                        from: 1,
                        fromEndIndex: 1,
                        id: 'P11',
                        pp: 1,
                        to: 2,
                        volume: 1,
                    },
                    {
                        arabic: 'C\nD.',
                        from: 2,
                        fromEndIndex: 1,
                        id: 'P21',
                        pp: 2,
                        to: 3,
                        volume: 1,
                    },
                    {
                        arabic: 'E\nF',
                        from: 3,
                        fromEndIndex: 1,
                        id: 'P31',
                        pp: 3,
                        to: 4,
                        volume: 1,
                    },
                ]);
            });
        });

        describe('custom punctuation', () => {
            it('should handle the three pages with punctuation', () => {
                const actual = segmentPages(
                    [
                        { content: `A`, id: 1, pp: 1, volume: 1 },
                        { content: `B. C`, id: 2, pp: 2, volume: 1 },
                        { content: `D. E`, id: 3, pp: 3, volume: 1 },
                        { content: `F`, id: 4, pp: 4, volume: 1 },
                    ],
                    { pageSpanning: CAPTURE_CONTINUOUS_PAGES, punctuations: '\n$' },
                );

                expect(actual).toEqual([
                    {
                        arabic: 'A\nB.',
                        from: 1,
                        fromEndIndex: 1,
                        id: 'P11',
                        pp: 1,
                        to: 2,
                        volume: 1,
                    },
                    {
                        arabic: 'C\nD.',
                        from: 2,
                        fromEndIndex: 1,
                        id: 'P21',
                        pp: 2,
                        to: 3,
                        volume: 1,
                    },
                    {
                        arabic: 'E\nF',
                        from: 3,
                        fromEndIndex: 1,
                        id: 'P31',
                        pp: 3,
                        to: 4,
                        volume: 1,
                    },
                ]);
            });
        });

        describe('square', () => {
            it('should capture the square brackets', () => {
                const lines = ['فأخبره ويسألني', '[٦٥] "إبراهيم" بن إسماعيل', '[٦٦] "إبراهيم" بن إسماعيل'];

                const actual = segmentPages([{ content: lines.join('\r'), id: 1, pp: 1, volume: 1 }], {
                    numeralStrategy: 'square',
                });

                expect(actual).toMatchObject([
                    {
                        arabic: 'فأخبره ويسألني',
                        from: 1,
                        id: 'P11',
                        pp: 1,
                        volume: 1,
                    },
                    {
                        arabic: '"إبراهيم" بن إسماعيل',
                        from: 1,
                        id: 'N65',
                        index: 65,
                        pp: 1,
                        volume: 1,
                    },
                    {
                        arabic: '"إبراهيم" بن إسماعيل',
                        from: 1,
                        id: 'N66',
                        index: 66,
                        pp: 1,
                        volume: 1,
                    },
                ]);
            });
        });

        describe('newEntryMarkerPattern', () => {
            it('should capture an entry starting with bullet points', () => {
                const lines = ['• A', '•B', 'C'];
                const actual = segmentPages([{ content: lines.join('\r'), id: 1, pp: 1, volume: 1 }], {
                    newEntryMarkerPattern: '^•\\s?(.*)',
                });

                expect(actual).toMatchObject([
                    {
                        arabic: 'A',
                        from: 1,
                        id: 'P11',
                        pp: 1,
                        volume: 1,
                    },
                    {
                        arabic: 'B\nC',
                        from: 1,
                        id: 'P12',
                        pp: 1,
                        volume: 1,
                    },
                ]);
            });
        });

        describe('prevEntryMarkerPattern', () => {
            it('should capture an entry since the last one ended with the pattern', () => {
                const lines = ['A', 'B 33.', 'C'];
                const actual = segmentPages([{ content: lines.join('\r'), id: 1, pp: 1, volume: 1 }], {
                    pageSpanning: 'trailing',
                    prevEntryMarkerPattern: ' \\d+\\.$',
                });

                expect(actual).toMatchObject([
                    {
                        arabic: 'A\nB 33.',
                        from: 1,
                        id: 'P11',
                        pp: 1,
                        volume: 1,
                    },
                    {
                        arabic: 'C',
                        from: 1,
                        id: 'P12',
                        pp: 1,
                        volume: 1,
                    },
                ]);
            });
        });
    });

    describe.only('mapLinesToTranslations', () => {
        it('should pick up the page segments', () => {
            const actual = mapLinesToTranslations('P11 - Abcd\nP22 - 2 - Something.');

            expect(actual).toMatchObject([
                {
                    id: 'P11',
                    text: 'Abcd',
                },
                {
                    id: 'P22',
                    text: '2 - Something.',
                },
            ]);
        });

        it('should match book numbers', () => {
            const actual = mapLinesToTranslations('B11 - Abcd\nB22 - 2 - Something.');

            expect(actual).toMatchObject([
                {
                    id: 'B11',
                    text: 'Abcd',
                },
                {
                    id: 'B22',
                    text: '2 - Something.',
                },
            ]);
        });

        it('should match book numbers', () => {
            const actual = mapLinesToTranslations('B11 - Abcd\nB22 - 2 - Something.');

            expect(actual).toMatchObject([
                {
                    id: 'B11',
                    text: 'Abcd',
                },
                {
                    id: 'B22',
                    text: '2 - Something.',
                },
            ]);
        });

        it('should match chapter numbers', () => {
            const actual = mapLinesToTranslations('C11 - Abcd\nC22 - 2 - Something.');

            expect(actual).toMatchObject([
                {
                    id: 'C11',
                    text: 'Abcd',
                },
                {
                    id: 'C22',
                    text: '2 - Something.',
                },
            ]);
        });

        it('should match narration numbers', () => {
            const actual = mapLinesToTranslations('N11 - Abcd\nN22 - 2 - Something.');

            expect(actual).toMatchObject([
                {
                    id: 'N11',
                    text: 'Abcd',
                },
                {
                    id: 'N22',
                    text: '2 - Something.',
                },
            ]);
        });
    });
});
