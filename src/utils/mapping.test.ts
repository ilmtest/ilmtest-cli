import { beforeEach, describe, expect, it } from 'bun:test';
import type { MatnParseOptions } from '../types';
import { mapLinesToTranslations, segmentPages } from './mapping';

// Helper to convert legacy patternToOptions to new markers format
const legacyPatternToMarker = (pattern: string, options: any = {}) => ({
    type: 'pattern' as const,
    pattern: pattern.replace(/^\^/, '^(?<full>(?<marker>').replace(/\)$/, ')(?<content>[\\s\\S]*))'),
    metadata: options,
});

describe('mapping', () => {
    let options: MatnParseOptions;

    describe('segmentPages', () => {
        describe('discrete', () => {
            beforeEach(() => {
                options = {
                    markers: [{
                        type: 'pattern',
                        pattern: '^(?<full>(?<marker>\\d+ - )(?<content>[\\s\\S]*))',
                    }],
                };
            });

            it('should trim the text', () => {
                const actual = segmentPages([{ content: ' ١٧٥٩ - تميم بن نذير ', id: 1, pp: 20, volume: 10 }]);

                expect(actual).toMatchObject([
                    { arabic: '١٧٥٩ - تميم بن نذير', from: 1, id: 'P1', pp: 20, volume: 10 },
                ]);
            });

            it('should capture chapter spans', () => {
                const actual = segmentPages([
                    { content: `<span data-type="title" id=toc-355> الحكم </span>`, id: 1, pp: 20, volume: 10 },
                ]);

                expect(actual).toMatchObject([{ arabic: 'الحكم', from: 1, id: 'C355', pp: 20, type: 2, volume: 10 }]);
            });

            it('should handle multiple narrations on the same page', () => {
                const actual = segmentPages([{ content: `22 - Something\n23 - Else`, id: 1, pp: 20, volume: 10 }], {
                    patternToOptions: { '^(\\d+ - .*)': {} },
                });

                expect(actual).toMatchObject([
                    { arabic: '22 - Something', from: 1, id: 'P1', pp: 20, volume: 10 },
                    { arabic: '23 - Else', from: 1, id: 'P1', pp: 20, volume: 10 },
                ]);
            });

            it('should just capture the page as the first loose leaf', () => {
                const actual = segmentPages([{ content: `Something\rSomething else`, id: 1, pp: 1, volume: 1 }]);

                expect(actual).toMatchObject([
                    { arabic: 'Something\nSomething else', from: 1, id: 'P1', pp: 1, volume: 1 },
                ]);
            });

            it('should capture indexed then a loose page', () => {
                const actual = segmentPages(
                    [
                        { content: `1 - Something.`, id: 1, pp: 1, volume: 1 },
                        { content: `Something else.`, id: 2, pp: 2, volume: 1 },
                    ],
                    options,
                );

                expect(actual).toMatchObject([
                    { arabic: '1 - Something.', from: 1, id: 'P1', pp: 1, volume: 1 },
                    { arabic: 'Something else.', from: 2, id: 'P2', pp: 2, volume: 1 },
                ]);
            });

            it('should capture index then loose page without punctuations', () => {
                const actual = segmentPages(
                    [
                        { content: `1 - Something`, id: 1, pp: 1, volume: 1 },
                        { content: `Something else`, id: 2, pp: 2, volume: 1 },
                    ],
                    options,
                );

                expect(actual).toMatchObject([
                    { arabic: '1 - Something', from: 1, id: 'P1', pp: 1, volume: 1 },
                    { arabic: 'Something else', from: 2, id: 'P2', pp: 2, volume: 1 },
                ]);
            });

            it('should capture index then loose page with more than one line', () => {
                const actual = segmentPages(
                    [
                        { content: `1 - Something`, id: 1, pp: 1, volume: 1 },
                        { content: `Something else\rNext line`, id: 2, pp: 2, volume: 1 },
                    ],
                    options,
                );

                expect(actual).toMatchObject([
                    { arabic: '1 - Something', from: 1, id: 'P1', pp: 1, volume: 1 },
                    { arabic: 'Something else\nNext line', from: 2, id: 'P2', pp: 2, volume: 1 },
                ]);
            });

            it('should capture index then loose page with more than one line then new page separately in a new entry', () => {
                const actual = segmentPages(
                    [
                        { content: `1 - Something`, id: 1, pp: 1, volume: 1 },
                        { content: `Something else\rNext line`, id: 2, pp: 2, volume: 1 },
                        { content: `New page`, id: 3, pp: 3, volume: 1 },
                    ],
                    options,
                );

                expect(actual).toMatchObject([
                    { arabic: '1 - Something', from: 1, id: 'P1', pp: 1, volume: 1 },
                    { arabic: 'Something else\nNext line', from: 2, id: 'P2' },
                    { arabic: 'New page', from: 3, id: 'P3', pp: 3, volume: 1 },
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
                        id: 'P1',
                        pp: 1,
                        volume: 1,
                    },
                    {
                        arabic: 'B. C',
                        from: 2,
                        id: 'P2',
                        pp: 2,
                        volume: 1,
                    },
                    {
                        arabic: 'D',
                        from: 3,
                        id: 'P3',
                        pp: 3,
                        volume: 1,
                    },
                ]);
            });
        });

        describe('discrete (new config)', () => {
            beforeEach(() => {
                options = {
                    markers: [
                        {
                            type: 'numbered',
                            numbering: 'latin', // Override default to use Latin numerals
                            removeMarker: false,
                        },
                    ],
                };
            });

            it('should trim the text', () => {
                const actual = segmentPages([{ content: ' ١٧٥٩ - تميم بن نذير ', id: 1, pp: 20, volume: 10 }]);

                expect(actual).toMatchObject([
                    { arabic: '١٧٥٩ - تميم بن نذير', from: 1, id: 'P1', pp: 20, volume: 10 },
                ]);
            });

            it('should handle multiple narrations on the same page', () => {
                const actual = segmentPages([{ content: `22 - Something\n23 - Else`, id: 1, pp: 20, volume: 10 }], {
                    markers: [
                        {
                            type: 'numbered',
                            numbering: 'latin',
                            separator: 'dash',
                            removeMarker: false,
                        },
                    ],
                });

                expect(actual).toMatchObject([
                    { arabic: '22 - Something', from: 1, id: 'P1', pp: 20, volume: 10 },
                    { arabic: '23 - Else', from: 1, id: 'P1', pp: 20, volume: 10 },
                ]);
            });

            it('should capture indexed then a loose page', () => {
                const actual = segmentPages(
                    [
                        { content: `1 - Something.`, id: 1, pp: 1, volume: 1 },
                        { content: `Something else.`, id: 2, pp: 2, volume: 1 },
                    ],
                    options,
                );

                expect(actual).toMatchObject([
                    { arabic: '1 - Something.', from: 1, id: 'P1', pp: 1, volume: 1 },
                    { arabic: 'Something else.', from: 2, id: 'P2', pp: 2, volume: 1 },
                ]);
            });
        });

        describe('trailing', () => {
            beforeEach(() => {
                options = { overflow: 'punctuation' };
            });

            it('should be two separate pages since first ends with punctuation', () => {
                const actual = segmentPages(
                    [
                        { content: `Some text.`, id: 1, pp: 1, volume: 1 },
                        { content: `More text.`, id: 2, pp: 2, volume: 1 },
                    ],
                    options,
                );

                expect(actual).toEqual([
                    {
                        arabic: 'Some text.',
                        from: 1,
                        id: 'P1',
                        pp: 1,
                        volume: 1,
                    },
                    {
                        arabic: 'More text.',
                        from: 2,
                        id: 'P2',
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
                    { overflow: 'next' },
                );

                expect(actual).toEqual([
                    {
                        arabic: 'Some text.\nMore text.',
                        from: 1,
                        id: 'P1',
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
                    options,
                );

                expect(actual).toEqual([
                    {
                        arabic: 'Something else.\nThis is the rest of the sentence.\nAfter that we have it\nAnother sentence.',
                        from: 1,

                        id: 'P1',
                        pp: 1,
                        to: 2,
                        volume: 1,
                    },
                    {
                        arabic: 'Rest of sentence',
                        from: 2,
                        id: 'P2',
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
                    { overflow: 'punctuation' },
                );

                expect(actual).toEqual([
                    {
                        arabic: 'A\nB.',
                        from: 1,
                        id: 'P1',
                        pp: 1,
                        to: 2,
                        volume: 1,
                    },
                    {
                        arabic: 'C\nD.',
                        from: 2,

                        id: 'P2',
                        pp: 2,
                        to: 3,
                        volume: 1,
                    },
                    {
                        arabic: 'E\nF',
                        from: 3,
                        id: 'P3',
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
                    options,
                );

                expect(actual).toEqual([
                    {
                        arabic: 'A\nB.',
                        from: 1,
                        id: 'P1',
                        pp: 1,
                        to: 2,
                        volume: 1,
                    },
                    {
                        arabic: 'C\nD.',
                        from: 2,

                        id: 'P2',
                        pp: 2,
                        to: 3,
                        volume: 1,
                    },
                    {
                        arabic: 'E\nF',
                        from: 3,

                        id: 'P3',
                        pp: 3,
                        to: 4,
                        volume: 1,
                    },
                ]);
            });
        });

        describe('square', () => {
            beforeEach(() => {
                options = {
                    patternToOptions: { '^(\\[[\\u0660-\\u0669]+\\] .*)': {} },
                };
            });

            it('should capture the square brackets', () => {
                const lines = ['فأخبره ويسألني', '[٦٥] "إبراهيم" بن إسماعيل', '[٦٦] "إبراهيم" بن إسماعيل'];

                const actual = segmentPages([{ content: lines.join('\r'), id: 1, pp: 1, volume: 1 }], options);

                expect(actual).toMatchObject([
                    {
                        arabic: 'فأخبره ويسألني',
                        from: 1,
                        id: 'P1',
                        pp: 1,
                        volume: 1,
                    },
                    {
                        arabic: '[٦٥] "إبراهيم" بن إسماعيل',
                        from: 1,
                        id: 'P1',
                        pp: 1,
                        volume: 1,
                    },
                    {
                        arabic: '[٦٦] "إبراهيم" بن إسماعيل',
                        from: 1,
                        id: 'P1',
                        pp: 1,
                        volume: 1,
                    },
                ]);
            });
        });

        describe('square (new config)', () => {
            beforeEach(() => {
                options = {
                    markers: [
                        {
                            type: 'pattern',
                            pattern: '^(\\[[\\u0660-\\u0669]+\\] .*)',
                            removeMarker: false,
                        },
                    ],
                };
            });

            it('should capture the square brackets', () => {
                const lines = ['فأخبره ويسألني', '[٦٥] "إبراهيم" بن إسماعيل', '[٦٦] "إبراهيم" بن إسماعيل'];

                const actual = segmentPages([{ content: lines.join('\r'), id: 1, pp: 1, volume: 1 }], options);

                expect(actual).toMatchObject([
                    {
                        arabic: 'فأخبره ويسألني',
                        from: 1,
                        id: 'P1',
                        pp: 1,
                        volume: 1,
                    },
                    {
                        arabic: '[٦٥] "إبراهيم" بن إسماعيل',
                        from: 1,
                        id: 'P1',
                        pp: 1,
                        volume: 1,
                    },
                    {
                        arabic: '[٦٦] "إبراهيم" بن إسماعيل',
                        from: 1,
                        id: 'P1',
                        pp: 1,
                        volume: 1,
                    },
                ]);
            });
        });

        describe('newEntryMarkerPattern', () => {
            beforeEach(() => {
                options = {
                    patternToOptions: { '^•\\s?(.*)': {} },
                };
            });

            it('should capture an entry starting with bullet points', () => {
                const lines = ['• A', '•B', 'C'];
                const actual = segmentPages([{ content: lines.join('\r'), id: 1, pp: 1, volume: 1 }], options);

                expect(actual).toMatchObject([
                    {
                        arabic: 'A',
                        from: 1,
                        id: 'P1',
                        pp: 1,
                        volume: 1,
                    },
                    {
                        arabic: 'B\nC',
                        from: 1,
                        id: 'P1',
                        pp: 1,
                        volume: 1,
                    },
                ]);
            });
        });

        describe('newEntryMarkerPattern (new config)', () => {
            beforeEach(() => {
                options = {
                    markers: [
                        {
                            type: 'bullet',
                            // Default removeMarker is true, which matches the behavior of the regex capture group in the old test
                        },
                    ],
                };
            });

            it('should capture an entry starting with bullet points', () => {
                const lines = ['• A', '•B', 'C'];
                const actual = segmentPages([{ content: lines.join('\r'), id: 1, pp: 1, volume: 1 }], options);

                expect(actual).toMatchObject([
                    {
                        arabic: '• A',
                        cleanContent: 'A',
                        from: 1,
                        id: 'P1',
                        pp: 1,
                        volume: 1,
                    },
                    {
                        arabic: '•B\nC',
                        cleanContent: 'B\nC',
                        from: 1,
                        id: 'P1',
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
                    overflow: 'punctuation',
                    prevEntryMarkerPattern: ' \\d+\\.$',
                });

                expect(actual).toMatchObject([
                    {
                        arabic: 'A\nB 33.',
                        from: 1,
                        id: 'P1',
                        pp: 1,
                        volume: 1,
                    },
                    {
                        arabic: 'C',
                        from: 1,
                        id: 'P1',
                        pp: 1,
                        volume: 1,
                    },
                ]);
            });
        });

        describe('patternToOptions with Arabic numerals', () => {
            // Arabic numerals: ٠١٢٣٤٥٦٧٨٩ (U+0660-U+0669)
            // Note: type: 0 is falsy in JS, so it won't be set. Use EntryType.Book (1) or EntryType.Chapter (2) for actual type assignment.

            describe('basic Arabic numeral with dash pattern', () => {
                beforeEach(() => {
                    options = {
                        patternToOptions: {
                            '^([\\u0660-\\u0669]+\\s?[-–—ـ].*)': { minPage: 153 },
                        },
                    };
                });

                it('should capture Arabic numeral followed by dash', () => {
                    const actual = segmentPages(
                        [{ content: '١٢٣ - حديث عن الصلاة', id: 153, pp: 1, volume: 1 }],
                        options,
                    );

                    expect(actual).toMatchObject([{ arabic: '١٢٣ - حديث عن الصلاة', from: 153 }]);
                });

                it('should capture Arabic numeral with em-dash (—)', () => {
                    const actual = segmentPages([{ content: '٤٥٦—نص الحديث', id: 153, pp: 1, volume: 1 }], options);

                    expect(actual).toMatchObject([{ arabic: '٤٥٦—نص الحديث', from: 153 }]);
                });

                it('should capture Arabic numeral with en-dash (–)', () => {
                    const actual = segmentPages([{ content: '٧٨٩–متن آخر', id: 153, pp: 1, volume: 1 }], options);

                    expect(actual).toMatchObject([{ arabic: '٧٨٩–متن آخر', from: 153 }]);
                });

                it('should capture Arabic numeral with tatweel (ـ)', () => {
                    const actual = segmentPages([{ content: '١٠ـ نص مع تطويل', id: 153, pp: 1, volume: 1 }], options);

                    expect(actual).toMatchObject([{ arabic: '١٠ـ نص مع تطويل', from: 153 }]);
                });

                it('should NOT capture as separate entry when page is below minPage', () => {
                    const actual = segmentPages(
                        [{ content: '١٢٣ - حديث عن الصلاة', id: 152, pp: 1, volume: 1 }],
                        options,
                    );

                    expect(actual).toMatchObject([{ arabic: '١٢٣ - حديث عن الصلاة', from: 152 }]);
                    expect(actual[0]).not.toHaveProperty('type');
                });
            });

            describe('basic Arabic numeral with dash pattern (new config)', () => {
                beforeEach(() => {
                    options = {
                        markers: [
                            {
                                type: 'numbered',
                                // numbering and separator default to 'arabic-indic' and 'dash'
                                minPage: 153,
                                removeMarker: false,
                            },
                        ],
                    };
                });

                it('should capture Arabic numeral followed by dash', () => {
                    const actual = segmentPages(
                        [{ content: '١٢٣ - حديث عن الصلاة', id: 153, pp: 1, volume: 1 }],
                        options,
                    );

                    expect(actual).toMatchObject([{ arabic: '١٢٣ - حديث عن الصلاة', from: 153 }]);
                });

                it('should capture Arabic numeral with em-dash (—)', () => {
                    const actual = segmentPages([{ content: '٤٥٦—نص الحديث', id: 153, pp: 1, volume: 1 }], options);

                    expect(actual).toMatchObject([{ arabic: '٤٥٦—نص الحديث', from: 153 }]);
                });

                it('should capture Arabic numeral with en-dash (–)', () => {
                    const actual = segmentPages([{ content: '٧٨٩–متن آخر', id: 153, pp: 1, volume: 1 }], options);

                    expect(actual).toMatchObject([{ arabic: '٧٨٩–متن آخر', from: 153 }]);
                });

                it('should capture Arabic numeral with tatweel (ـ)', () => {
                    const actual = segmentPages([{ content: '١٠ـ نص مع تطويل', id: 153, pp: 1, volume: 1 }], options);

                    expect(actual).toMatchObject([{ arabic: '١٠ـ نص مع تطويل', from: 153 }]);
                });

                it('should NOT capture as separate entry when page is below minPage', () => {
                    const actual = segmentPages(
                        [{ content: '١٢٣ - حديث عن الصلاة', id: 152, pp: 1, volume: 1 }],
                        options,
                    );

                    expect(actual).toMatchObject([{ arabic: '١٢٣ - حديث عن الصلاة', from: 152 }]);
                    expect(actual[0]).not.toHaveProperty('type');
                });
            });

            describe('Arabic numeral + space + Arabic letter + dash', () => {
                beforeEach(() => {
                    options = {
                        patternToOptions: {
                            '^([\\u0660-\\u0669]+ [أ-ي]\\s?[-–—ـ].*)': { minPage: 153 },
                        },
                    };
                });

                it('should capture numeral followed by space, Arabic letter, and dash', () => {
                    const actual = segmentPages([{ content: '١٢٣ أ - نص الحديث', id: 153, pp: 1, volume: 1 }], options);

                    expect(actual).toMatchObject([{ arabic: '١٢٣ أ - نص الحديث', from: 153 }]);
                });

                it('should capture with different Arabic letters', () => {
                    const actual = segmentPages([{ content: '٤٥ ب—متن آخر', id: 153, pp: 1, volume: 1 }], options);

                    expect(actual).toMatchObject([{ arabic: '٤٥ ب—متن آخر', from: 153 }]);
                });
            });

            describe('bullet points followed by Arabic numerals', () => {
                beforeEach(() => {
                    options = {
                        patternToOptions: {
                            '^[•*° ]+([\\u0660-\\u0669]+\\s?[-–—ـ].*)': { minPage: 153 },
                        },
                    };
                });

                it('should capture bullet (•) followed by numeral and dash', () => {
                    const actual = segmentPages([{ content: '• ١٢٣ - حديث', id: 153, pp: 1, volume: 1 }], options);

                    expect(actual).toMatchObject([{ arabic: '١٢٣ - حديث', from: 153 }]);
                });

                it('should capture asterisk (*) followed by numeral and dash', () => {
                    const actual = segmentPages([{ content: '* ٤٥٦ – متن', id: 153, pp: 1, volume: 1 }], options);

                    expect(actual).toMatchObject([{ arabic: '٤٥٦ – متن', from: 153 }]);
                });

                it('should capture degree (°) followed by numeral and dash', () => {
                    const actual = segmentPages([{ content: '° ٧٨٩—نص', id: 153, pp: 1, volume: 1 }], options);

                    expect(actual).toMatchObject([{ arabic: '٧٨٩—نص', from: 153 }]);
                });

                it('should capture multiple bullets/spaces', () => {
                    const actual = segmentPages([{ content: '•* ١٠ـ حديث', id: 153, pp: 1, volume: 1 }], options);

                    expect(actual).toMatchObject([{ arabic: '١٠ـ حديث', from: 153 }]);
                });
            });

            describe('bullets with optional slash between numerals', () => {
                beforeEach(() => {
                    options = {
                        patternToOptions: {
                            '^[•*° ]+([\\u0660-\\u0669]+(?: ?/ ?[\\u0660-\\u0669]+)?\\s?[-–—ـ].*)': { minPage: 153 },
                        },
                    };
                });

                it('should capture bullet + numeral/numeral + dash', () => {
                    const actual = segmentPages(
                        [{ content: '• ١٢٣/٤٥٦ - حديث مركب', id: 153, pp: 1, volume: 1 }],
                        options,
                    );

                    expect(actual).toMatchObject([{ arabic: '١٢٣/٤٥٦ - حديث مركب', from: 153 }]);
                });

                it('should capture bullet + numeral / numeral (with spaces) + dash', () => {
                    const actual = segmentPages([{ content: '* ٧٨ / ٩٠ – متن', id: 153, pp: 1, volume: 1 }], options);

                    expect(actual).toMatchObject([{ arabic: '٧٨ / ٩٠ – متن', from: 153 }]);
                });

                it('should capture single numeral without slash', () => {
                    const actual = segmentPages([{ content: '° ٥٥ - نص عادي', id: 153, pp: 1, volume: 1 }], options);

                    expect(actual).toMatchObject([{ arabic: '٥٥ - نص عادي', from: 153 }]);
                });
            });

            describe('specific phrase patterns (بسم الله، أخبرنا، etc.)', () => {
                beforeEach(() => {
                    options = {
                        patternToOptions: {
                            '^((\\[بِسْمِ |بِسْمِ اللَّهِ|أَخْبَرَنَا|مسند الإمام|بسم الله الرحمن|\\[سادس|\\[آخر مسند|word3).*)': {},
                        },
                    };
                });

                it('should capture lines starting with بِسْمِ اللَّهِ', () => {
                    const actual = segmentPages(
                        [{ content: 'بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ', id: 1, pp: 1, volume: 1 }],
                        options,
                    );

                    expect(actual).toMatchObject([{ arabic: 'بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ', from: 1 }]);
                });

                it('should capture lines starting with أَخْبَرَنَا', () => {
                    const actual = segmentPages([{ content: 'أَخْبَرَنَا فلان عن فلان', id: 1, pp: 1, volume: 1 }], options);

                    expect(actual).toMatchObject([{ arabic: 'أَخْبَرَنَا فلان عن فلان', from: 1 }]);
                });

                it('should capture lines starting with مسند الإمام', () => {
                    const actual = segmentPages(
                        [{ content: 'مسند الإمام أحمد بن حنبل', id: 1, pp: 1, volume: 1 }],
                        options,
                    );

                    expect(actual).toMatchObject([{ arabic: 'مسند الإمام أحمد بن حنبل', from: 1 }]);
                });

                it('should capture lines starting with بسم الله الرحمن', () => {
                    const actual = segmentPages(
                        [{ content: 'بسم الله الرحمن الرحيم وبه نستعين', id: 1, pp: 1, volume: 1 }],
                        options,
                    );

                    expect(actual).toMatchObject([{ arabic: 'بسم الله الرحمن الرحيم وبه نستعين', from: 1 }]);
                });

                it('should capture lines starting with [بِسْمِ', () => {
                    const actual = segmentPages([{ content: '[بِسْمِ اللَّهِ]', id: 1, pp: 1, volume: 1 }], options);

                    expect(actual).toMatchObject([{ arabic: '[بِسْمِ اللَّهِ]', from: 1 }]);
                });

                it('should capture lines starting with [سادس', () => {
                    const actual = segmentPages([{ content: '[سادس عشر]', id: 1, pp: 1, volume: 1 }], options);

                    expect(actual).toMatchObject([{ arabic: '[سادس عشر]', from: 1 }]);
                });

                it('should capture lines starting with [آخر مسند', () => {
                    const actual = segmentPages([{ content: '[آخر مسند أبي بكر]', id: 1, pp: 1, volume: 1 }], options);

                    expect(actual).toMatchObject([{ arabic: '[آخر مسند أبي بكر]', from: 1 }]);
                });
            });

            describe('optional bullet + dots + slash + numerals', () => {
                beforeEach(() => {
                    options = {
                        patternToOptions: {
                            '^[•*°]?\\.? ?\\.? ?\\.? ?/ ?([\\u0660-\\u0669]+\\s?[-–—ـ].*)': { minPage: 153 },
                        },
                    };
                });

                it('should capture slash followed by numeral and dash', () => {
                    const actual = segmentPages([{ content: '/ ١٢٣ - حديث', id: 153, pp: 1, volume: 1 }], options);

                    expect(actual).toMatchObject([{ arabic: '١٢٣ - حديث', from: 153 }]);
                });

                it('should capture bullet + dots + slash pattern', () => {
                    const actual = segmentPages(
                        [{ content: '•. . . / ٤٥٦ – متن', id: 153, pp: 1, volume: 1 }],
                        options,
                    );

                    expect(actual).toMatchObject([{ arabic: '٤٥٦ – متن', from: 153 }]);
                });

                it('should capture asterisk + single dot + slash pattern', () => {
                    const actual = segmentPages([{ content: '*. / ٧٨٩—نص', id: 153, pp: 1, volume: 1 }], options);

                    expect(actual).toMatchObject([{ arabic: '٧٨٩—نص', from: 153 }]);
                });

                it('should capture degree symbol + dots + slash', () => {
                    const actual = segmentPages([{ content: '°. . /١٠ـ حديث', id: 153, pp: 1, volume: 1 }], options);

                    expect(actual).toMatchObject([{ arabic: '١٠ـ حديث', from: 153 }]);
                });
            });

            describe('parenthesized bullet + numerals', () => {
                beforeEach(() => {
                    options = {
                        patternToOptions: {
                            '^\\([•*°]\\) ?([\\u0660-\\u0669]+\\s?[-–—ـ].*)': { minPage: 153 },
                        },
                    };
                });

                it('should capture (•) followed by numeral and dash', () => {
                    const actual = segmentPages([{ content: '(•) ١٢٣ - حديث', id: 153, pp: 1, volume: 1 }], options);

                    expect(actual).toMatchObject([{ arabic: '١٢٣ - حديث', from: 153 }]);
                });

                it('should capture (*) followed by numeral and dash', () => {
                    const actual = segmentPages([{ content: '(*) ٤٥٦ – متن', id: 153, pp: 1, volume: 1 }], options);

                    expect(actual).toMatchObject([{ arabic: '٤٥٦ – متن', from: 153 }]);
                });

                it('should capture (°) followed by numeral without space', () => {
                    const actual = segmentPages([{ content: '(°)٧٨٩—نص', id: 153, pp: 1, volume: 1 }], options);

                    expect(actual).toMatchObject([{ arabic: '٧٨٩—نص', from: 153 }]);
                });
            });

            describe('comma-separated Arabic numerals', () => {
                beforeEach(() => {
                    options = {
                        patternToOptions: {
                            '^([\\u0660-\\u0669]+(?:، ?[\\u0660-\\u0669]+)*\\s?[-–—ـ].*)': { minPage: 153 },
                        },
                    };
                });

                it('should capture single numeral with dash', () => {
                    const actual = segmentPages([{ content: '١٢٣ - حديث واحد', id: 153, pp: 1, volume: 1 }], options);

                    expect(actual).toMatchObject([{ arabic: '١٢٣ - حديث واحد', from: 153 }]);
                });

                it('should capture two comma-separated numerals', () => {
                    const actual = segmentPages([{ content: '١٢٣، ٤٥٦ - حديثان', id: 153, pp: 1, volume: 1 }], options);

                    expect(actual).toMatchObject([{ arabic: '١٢٣، ٤٥٦ - حديثان', from: 153 }]);
                });

                it('should capture multiple comma-separated numerals', () => {
                    const actual = segmentPages(
                        [{ content: '١، ٢، ٣، ٤ – أحاديث متعددة', id: 153, pp: 1, volume: 1 }],
                        options,
                    );

                    expect(actual).toMatchObject([{ arabic: '١، ٢، ٣، ٤ – أحاديث متعددة', from: 153 }]);
                });

                it('should capture comma-separated numerals without space after comma', () => {
                    const actual = segmentPages([{ content: '٧٨٩،١٠—متن', id: 153, pp: 1, volume: 1 }], options);

                    expect(actual).toMatchObject([{ arabic: '٧٨٩،١٠—متن', from: 153 }]);
                });
            });

            describe('numerals with optional slash pattern', () => {
                beforeEach(() => {
                    options = {
                        patternToOptions: {
                            '^([\\u0660-\\u0669]+(?: ?/ ?[\\u0660-\\u0669]+)?\\s?[-–—ـ].*)': { minPage: 153 },
                        },
                    };
                });

                it('should capture single numeral with dash', () => {
                    const actual = segmentPages([{ content: '١٢٣ - حديث', id: 153, pp: 1, volume: 1 }], options);

                    expect(actual).toMatchObject([{ arabic: '١٢٣ - حديث', from: 153 }]);
                });

                it('should capture numeral/numeral with dash', () => {
                    const actual = segmentPages([{ content: '٤٥٦/٧٨٩ – متن', id: 153, pp: 1, volume: 1 }], options);

                    expect(actual).toMatchObject([{ arabic: '٤٥٦/٧٨٩ – متن', from: 153 }]);
                });

                it('should capture numeral / numeral (with spaces) with dash', () => {
                    const actual = segmentPages([{ content: '١٠ / ٢٠ — نص', id: 153, pp: 1, volume: 1 }], options);

                    expect(actual).toMatchObject([{ arabic: '١٠ / ٢٠ — نص', from: 153 }]);
                });
            });

            describe('numerals with optional slash and Arabic character', () => {
                beforeEach(() => {
                    options = {
                        patternToOptions: {
                            '^([\\u0660-\\u0669]+(?: ?/[\\u0660-\\u0669أ-ي])?\\s?[-–—ـ].*)': { minPage: 153 },
                        },
                    };
                });

                it('should capture numeral with slash and numeral', () => {
                    const actual = segmentPages([{ content: '١٢٣/٤ - حديث', id: 153, pp: 1, volume: 1 }], options);

                    expect(actual).toMatchObject([{ arabic: '١٢٣/٤ - حديث', from: 153 }]);
                });

                it('should capture numeral with slash and Arabic letter', () => {
                    const actual = segmentPages([{ content: '٤٥٦/أ – متن', id: 153, pp: 1, volume: 1 }], options);

                    expect(actual).toMatchObject([{ arabic: '٤٥٦/أ – متن', from: 153 }]);
                });

                it('should capture numeral with space + slash + letter', () => {
                    const actual = segmentPages([{ content: '٧٨٩ /ب — نص', id: 153, pp: 1, volume: 1 }], options);

                    expect(actual).toMatchObject([{ arabic: '٧٨٩ /ب — نص', from: 153 }]);
                });

                it('should capture single numeral without slash', () => {
                    const actual = segmentPages([{ content: '١٠ـ حديث بسيط', id: 153, pp: 1, volume: 1 }], options);

                    expect(actual).toMatchObject([{ arabic: '١٠ـ حديث بسيط', from: 153 }]);
                });
            });

            describe('numerals with optional slash + optional numerals + Arabic letter', () => {
                beforeEach(() => {
                    options = {
                        patternToOptions: {
                            '^([\\u0660-\\u0669]+(?: ?/ ?[\\u0660-\\u0669]*[أ-ي])?\\s?[-–—ـ].*)': { minPage: 153 },
                        },
                    };
                });

                it('should capture numeral / letter pattern', () => {
                    const actual = segmentPages([{ content: '١٢٣ / أ - حديث', id: 153, pp: 1, volume: 1 }], options);

                    expect(actual).toMatchObject([{ arabic: '١٢٣ / أ - حديث', from: 153 }]);
                });

                it('should capture numeral / numeral + letter pattern', () => {
                    const actual = segmentPages([{ content: '٤٥٦ / ٧ب – متن', id: 153, pp: 1, volume: 1 }], options);

                    expect(actual).toMatchObject([{ arabic: '٤٥٦ / ٧ب – متن', from: 153 }]);
                });

                it('should capture numeral/numerals+letter pattern (no spaces)', () => {
                    const actual = segmentPages([{ content: '٧٨٩/١٢ج — نص', id: 153, pp: 1, volume: 1 }], options);

                    expect(actual).toMatchObject([{ arabic: '٧٨٩/١٢ج — نص', from: 153 }]);
                });

                it('should capture single numeral without slash', () => {
                    const actual = segmentPages([{ content: '١٠ـ حديث', id: 153, pp: 1, volume: 1 }], options);

                    expect(actual).toMatchObject([{ arabic: '١٠ـ حديث', from: 153 }]);
                });
            });

            describe('combined patternToOptions', () => {
                beforeEach(() => {
                    options = {
                        patternToOptions: {
                            '^((\\[بِسْمِ |بِسْمِ اللَّهِ|أَخْبَرَنَا|مسند الإمام|بسم الله الرحمن|\\[سادس|\\[آخر مسند|word3).*)': {},
                            '^([\\u0660-\\u0669]+ [أ-ي]\\s?[-–—ـ].*)': { minPage: 153 },
                            '^([\\u0660-\\u0669]+\\s?[-–—ـ].*)': { minPage: 153 },
                            '^[•*° ]+([\\u0660-\\u0669]+\\s?[-–—ـ].*)': { minPage: 153 },
                        },
                    };
                });

                it('should match simple numeral pattern', () => {
                    const actual = segmentPages([{ content: '١٢٣ - حديث', id: 153, pp: 1, volume: 1 }], options);

                    expect(actual).toMatchObject([{ arabic: '١٢٣ - حديث', from: 153 }]);
                });

                it('should match bullet pattern', () => {
                    const actual = segmentPages([{ content: '• ٤٥٦ - متن', id: 153, pp: 1, volume: 1 }], options);

                    expect(actual).toMatchObject([{ arabic: '٤٥٦ - متن', from: 153 }]);
                });

                it('should match phrase pattern (no minPage restriction)', () => {
                    const actual = segmentPages([{ content: 'أَخْبَرَنَا فلان', id: 1, pp: 1, volume: 1 }], options);

                    expect(actual).toMatchObject([{ arabic: 'أَخْبَرَنَا فلان', from: 1 }]);
                });

                it('should handle multiple entries on same page', () => {
                    const lines = ['١ - حديث أول', '٢ - حديث ثاني', '• ٣ - حديث ثالث'];
                    const actual = segmentPages([{ content: lines.join('\r'), id: 153, pp: 1, volume: 1 }], options);

                    expect(actual).toMatchObject([
                        { arabic: '١ - حديث أول', from: 153 },
                        { arabic: '٢ - حديث ثاني', from: 153 },
                        { arabic: '٣ - حديث ثالث', from: 153 },
                    ]);
                });

                it('should handle mixing minPage and non-minPage patterns', () => {
                    const actual = segmentPages(
                        [
                            { content: 'بِسْمِ اللَّهِ الرحمن الرحيم', id: 1, pp: 1, volume: 1 },
                            { content: '١٢٣ - حديث', id: 153, pp: 153, volume: 1 },
                        ],
                        options,
                    );

                    expect(actual).toMatchObject([
                        { arabic: 'بِسْمِ اللَّهِ الرحمن الرحيم', from: 1 },
                        { arabic: '١٢٣ - حديث', from: 153 },
                    ]);
                });
            });

            describe('patternToOptions with EntryType', () => {
                it('should set type when using EntryType.Book', () => {
                    const actual = segmentPages([{ content: '١٢٣ - حديث', id: 153, pp: 1, volume: 1 }], {
                        patternToOptions: {
                            '^([\\u0660-\\u0669]+\\s?[-–—ـ].*)': { minPage: 153, type: 1 },
                        },
                    });

                    expect(actual).toMatchObject([{ arabic: '١٢٣ - حديث', from: 153, type: 1 }]);
                });

                it('should set type when using EntryType.Chapter', () => {
                    const actual = segmentPages([{ content: '٤٥٦ – متن', id: 153, pp: 1, volume: 1 }], {
                        patternToOptions: {
                            '^([\\u0660-\\u0669]+\\s?[-–—ـ].*)': { minPage: 153, type: 2 },
                        },
                    });

                    expect(actual).toMatchObject([{ arabic: '٤٥٦ – متن', from: 153, type: 2 }]);
                });
            });

            describe('section/chapter keyword patterns', () => {
                beforeEach(() => {
                    options = {
                        patternToOptions: {
                            '^((والقسم|الفصل|الثاني|الثالث|أعلم|الأول|والثاني|والثالث|القسم|الخامس|واعلم|الرابع).*)':
                                {},
                        },
                    };
                });

                it('should capture lines starting with الفصل', () => {
                    const actual = segmentPages(
                        [{ content: 'الفصل الأول في الصلاة', id: 1, pp: 1, volume: 1 }],
                        options,
                    );
                    expect(actual).toMatchObject([{ arabic: 'الفصل الأول في الصلاة', from: 1 }]);
                });

                it('should capture lines starting with القسم', () => {
                    const actual = segmentPages(
                        [{ content: 'القسم الثاني من الكتاب', id: 1, pp: 1, volume: 1 }],
                        options,
                    );
                    expect(actual).toMatchObject([{ arabic: 'القسم الثاني من الكتاب', from: 1 }]);
                });

                it('should capture lines starting with الأول', () => {
                    const actual = segmentPages([{ content: 'الأول: في بيان كذا', id: 1, pp: 1, volume: 1 }], options);
                    expect(actual).toMatchObject([{ arabic: 'الأول: في بيان كذا', from: 1 }]);
                });

                it('should capture lines starting with واعلم', () => {
                    const actual = segmentPages([{ content: 'واعلم أن هذا مهم', id: 1, pp: 1, volume: 1 }], options);
                    expect(actual).toMatchObject([{ arabic: 'واعلم أن هذا مهم', from: 1 }]);
                });
            });

            describe('question/answer keyword patterns', () => {
                beforeEach(() => {
                    options = {
                        patternToOptions: {
                            '^((قلنا|أحدها|وثانيها|الوجه|وثالثها|الأول|السؤال|والثاني|الثاني|الشبهة|الرابع|المسألة).*)':
                                {},
                        },
                    };
                });

                it('should capture lines starting with قلنا', () => {
                    const actual = segmentPages([{ content: 'قلنا: هذا جوابه كذا', id: 1, pp: 1, volume: 1 }], options);
                    expect(actual).toMatchObject([{ arabic: 'قلنا: هذا جوابه كذا', from: 1 }]);
                });

                it('should capture lines starting with أحدها', () => {
                    const actual = segmentPages([{ content: 'أحدها: أن يكون كذا', id: 1, pp: 1, volume: 1 }], options);
                    expect(actual).toMatchObject([{ arabic: 'أحدها: أن يكون كذا', from: 1 }]);
                });

                it('should capture lines starting with المسألة', () => {
                    const actual = segmentPages(
                        [{ content: 'المسألة الأولى في الوضوء', id: 1, pp: 1, volume: 1 }],
                        options,
                    );
                    expect(actual).toMatchObject([{ arabic: 'المسألة الأولى في الوضوء', from: 1 }]);
                });

                it('should capture lines starting with السؤال', () => {
                    const actual = segmentPages([{ content: 'السؤال: ما حكم كذا؟', id: 1, pp: 1, volume: 1 }], options);
                    expect(actual).toMatchObject([{ arabic: 'السؤال: ما حكم كذا؟', from: 1 }]);
                });
            });

            describe('بَابُ/باب chapter patterns with type 2', () => {
                it('should capture بَابُ with type Chapter', () => {
                    const actual = segmentPages([{ content: 'بَابُ الطهارة', id: 1, pp: 1, volume: 1 }], {
                        patternToOptions: { '^((بَابُ).*)': { type: 2 } },
                    });
                    expect(actual).toMatchObject([{ arabic: 'بَابُ الطهارة', from: 1, type: 2 }]);
                });

                it('should capture باب with type Chapter', () => {
                    const actual = segmentPages([{ content: 'باب الصلاة', id: 1, pp: 1, volume: 1 }], {
                        patternToOptions: { '^((باب).*)': { type: 2 } },
                    });
                    expect(actual).toMatchObject([{ arabic: 'باب الصلاة', from: 1, type: 2 }]);
                });

                it('should capture بَابٌ with type Chapter', () => {
                    const actual = segmentPages([{ content: 'بَابٌ في الزكاة', id: 1, pp: 1, volume: 1 }], {
                        patternToOptions: { '^(بَابٌ.*)': { type: 2 } },
                    });
                    expect(actual).toMatchObject([{ arabic: 'بَابٌ في الزكاة', from: 1, type: 2 }]);
                });
            });

            describe('numeral + حدَّثنا patterns', () => {
                it('should capture numeral followed by حدَّثنا', () => {
                    const actual = segmentPages([{ content: '١٢٣ حدَّثنا فلان', id: 1, pp: 1, volume: 1 }], {
                        patternToOptions: { '^(([\\u0660-\\u0669]+ حدَّثنا).*)': {} },
                    });
                    expect(actual).toMatchObject([{ arabic: '١٢٣ حدَّثنا فلان', from: 1 }]);
                });

                it('should capture numeral + dash + حدَّثنا', () => {
                    const actual = segmentPages([{ content: '٤٥٦ - حدَّثنا فلان', id: 1, pp: 1, volume: 1 }], {
                        patternToOptions: { '^(([\\u0660-\\u0669]+\\s?[-–—ـ]\\s*حدَّثنا).*)': {} },
                    });
                    expect(actual).toMatchObject([{ arabic: '٤٥٦ - حدَّثنا فلان', from: 1 }]);
                });

                it('should capture numeral with sukun + حدَّثنا', () => {
                    const actual = segmentPages([{ content: 'ْ١٢٣ حدَّثنا فلان', id: 1, pp: 1, volume: 1 }], {
                        patternToOptions: { '^(([ْ]?[\\u0660-\\u0669]+ حدَّثنا).*)': {} },
                    });
                    expect(actual).toMatchObject([{ arabic: 'ْ١٢٣ حدَّثنا فلان', from: 1 }]);
                });
            });

            describe('numeral with parenthesized Arabic text', () => {
                it('should capture numeral + parenthesized text + dash', () => {
                    const actual = segmentPages([{ content: '١٢٣ (صحيح) - متن الحديث', id: 1, pp: 1, volume: 1 }], {
                        patternToOptions: {
                            '^(([\\u0660-\\u0669]+\\s*\\([\\u0600-\\u06FF\\u0660-\\u0669\\s]+\\)\\s*[-–—ـ]).*)': {},
                        },
                    });
                    expect(actual).toMatchObject([{ arabic: '١٢٣ (صحيح) - متن الحديث', from: 1 }]);
                });

                it('should capture numeral + parenthesized text with numerals + dash', () => {
                    const actual = segmentPages([{ content: '٤٥٦ (رقم ١٢٣) – الحديث', id: 1, pp: 1, volume: 1 }], {
                        patternToOptions: {
                            '^(([\\u0660-\\u0669]+\\s*\\([\\u0600-\\u06FF\\u0660-\\u0669\\s]+\\)\\s*[-–—ـ]).*)': {},
                        },
                    });
                    expect(actual).toMatchObject([{ arabic: '٤٥٦ (رقم ١٢٣) – الحديث', from: 1 }]);
                });
            });

            describe('numeral with م (mirrored/repeated)', () => {
                it('should capture numeral + م + dash', () => {
                    const actual = segmentPages([{ content: '١٢٣ م - حديث مكرر', id: 1, pp: 1, volume: 1 }], {
                        patternToOptions: { '^(([\\u0660-\\u0669]+ م\\s?[-–—ـ]).*)': {} },
                    });
                    expect(actual).toMatchObject([{ arabic: '١٢٣ م - حديث مكرر', from: 1 }]);
                });

                it('should capture numeral + م + dash in combined pattern', () => {
                    const actual = segmentPages([{ content: '٤٥٦ م – متن', id: 1, pp: 1, volume: 1 }], {
                        patternToOptions: {
                            '^(([\\u0660-\\u0669]+\\s?[-–—ـ]|[\\u0660-\\u0669]+ م [-–—ـ]).*)': {},
                        },
                    });
                    expect(actual).toMatchObject([{ arabic: '٤٥٦ م – متن', from: 1 }]);
                });
            });

            describe('square bracket numeral patterns', () => {
                it('should capture [numeral] pattern', () => {
                    const actual = segmentPages([{ content: '[١٢٣] متن الحديث', id: 1, pp: 1, volume: 1 }], {
                        patternToOptions: { '^[•°]?\\s?(\\[[\\u0660-\\u0669]+\\].*)': {} },
                    });
                    expect(actual).toMatchObject([{ arabic: '[١٢٣] متن الحديث', from: 1 }]);
                });

                it('should capture • [numeral] pattern', () => {
                    const actual = segmentPages([{ content: '• [٤٥٦] حديث', id: 1, pp: 1, volume: 1 }], {
                        patternToOptions: { '^[•°]?\\s?(\\[[\\u0660-\\u0669]+\\].*)': {} },
                    });
                    expect(actual).toMatchObject([{ arabic: '[٤٥٦] حديث', from: 1 }]);
                });

                it('should capture ° [numeral] pattern', () => {
                    const actual = segmentPages([{ content: '° [٧٨٩] نص', id: 1, pp: 1, volume: 1 }], {
                        patternToOptions: { '^[•°]?\\s?(\\[[\\u0660-\\u0669]+\\].*)': {} },
                    });
                    expect(actual).toMatchObject([{ arabic: '[٧٨٩] نص', from: 1 }]);
                });

                it('should capture □[numeral ز] pattern', () => {
                    const actual = segmentPages([{ content: '□[١٢٣ ز] حديث زائد', id: 1, pp: 1, volume: 1 }], {
                        patternToOptions: { '^□\\[[\\u0660-\\u0669]+ ز\\] (.*)': {} },
                    });
                    expect(actual).toMatchObject([{ arabic: 'حديث زائد', from: 1 }]);
                });
            });

            describe('tafsir patterns', () => {
                it('should capture تفسير سورة with type Chapter', () => {
                    const actual = segmentPages([{ content: 'تفسير سورة البقرة', id: 1, pp: 1, volume: 1 }], {
                        patternToOptions: { '^((تفسير سورة).*)': { type: 2 } },
                    });
                    expect(actual).toMatchObject([{ arabic: 'تفسير سورة البقرة', from: 1, type: 2 }]);
                });

                it('should capture القولُ في تأويلِ', () => {
                    const actual = segmentPages([{ content: 'القولُ في تأويلِ قوله تعالى', id: 1, pp: 1, volume: 1 }], {
                        patternToOptions: { '^((القولُ في تأويلِ).*)': {} },
                    });
                    expect(actual).toMatchObject([{ arabic: 'القولُ في تأويلِ قوله تعالى', from: 1 }]);
                });

                it('should capture يقولُ تعالى ذكرُه', () => {
                    const actual = segmentPages([{ content: 'يقولُ تعالى ذكرُه: كذا', id: 1, pp: 1, volume: 1 }], {
                        patternToOptions: { '^((يقولُ تعالى ذكرُه).*)': {} },
                    });
                    expect(actual).toMatchObject([{ arabic: 'يقولُ تعالى ذكرُه: كذا', from: 1 }]);
                });
            });

            describe('hadith narrator patterns', () => {
                beforeEach(() => {
                    options = {
                        patternToOptions: {
                            '^((حدَّثنا|حدثنا|حدَّثني|حدثني|وحدَّثنا|كما حدثنا|كما حدَّثنا|حُدِّثت عن).*)': {},
                        },
                    };
                });

                it('should capture حدَّثنا', () => {
                    const actual = segmentPages([{ content: 'حدَّثنا فلان عن فلان', id: 1, pp: 1, volume: 1 }], options);
                    expect(actual).toMatchObject([{ arabic: 'حدَّثنا فلان عن فلان', from: 1 }]);
                });

                it('should capture حدثني', () => {
                    const actual = segmentPages([{ content: 'حدثني أبي عن جدي', id: 1, pp: 1, volume: 1 }], options);
                    expect(actual).toMatchObject([{ arabic: 'حدثني أبي عن جدي', from: 1 }]);
                });

                it('should capture وحدَّثنا', () => {
                    const actual = segmentPages([{ content: 'وحدَّثنا فلان أيضا', id: 1, pp: 1, volume: 1 }], options);
                    expect(actual).toMatchObject([{ arabic: 'وحدَّثنا فلان أيضا', from: 1 }]);
                });

                it('should capture حُدِّثت عن', () => {
                    const actual = segmentPages([{ content: 'حُدِّثت عن الحسن', id: 1, pp: 1, volume: 1 }], options);
                    expect(actual).toMatchObject([{ arabic: 'حُدِّثت عن الحسن', from: 1 }]);
                });
            });

            describe('phrase starter patterns (وَاعْلَمْ، حَدَّثَنَا، etc.)', () => {
                beforeEach(() => {
                    options = {
                        patternToOptions: {
                            '^(([\\u0660-\\u0669]+\\s?[-–—ـ]|•|وَاعْلَمْ|وَكَذَلِكَ|حَدَّثَنَا|قُلْنَا|فَأَمَّا|قَالَ أَبُو).*)': {},
                        },
                    };
                });

                it('should capture وَاعْلَمْ', () => {
                    const actual = segmentPages([{ content: 'وَاعْلَمْ أَنَّ هَذَا مُهِمٌّ', id: 1, pp: 1, volume: 1 }], options);
                    expect(actual).toMatchObject([{ arabic: 'وَاعْلَمْ أَنَّ هَذَا مُهِمٌّ', from: 1 }]);
                });

                it('should capture وَكَذَلِكَ', () => {
                    const actual = segmentPages([{ content: 'وَكَذَلِكَ قَالَ فُلَانٌ', id: 1, pp: 1, volume: 1 }], options);
                    expect(actual).toMatchObject([{ arabic: 'وَكَذَلِكَ قَالَ فُلَانٌ', from: 1 }]);
                });

                it('should capture حَدَّثَنَا', () => {
                    const actual = segmentPages([{ content: 'حَدَّثَنَا فُلَانٌ', id: 1, pp: 1, volume: 1 }], options);
                    expect(actual).toMatchObject([{ arabic: 'حَدَّثَنَا فُلَانٌ', from: 1 }]);
                });

                it('should capture قُلْنَا', () => {
                    const actual = segmentPages([{ content: 'قُلْنَا: الجَوَابُ كَذَا', id: 1, pp: 1, volume: 1 }], options);
                    expect(actual).toMatchObject([{ arabic: 'قُلْنَا: الجَوَابُ كَذَا', from: 1 }]);
                });

                it('should capture فَأَمَّا', () => {
                    const actual = segmentPages([{ content: 'فَأَمَّا الأَوَّلُ فَكَذَا', id: 1, pp: 1, volume: 1 }], options);
                    expect(actual).toMatchObject([{ arabic: 'فَأَمَّا الأَوَّلُ فَكَذَا', from: 1 }]);
                });

                it('should capture قَالَ أَبُو', () => {
                    const actual = segmentPages([{ content: 'قَالَ أَبُو عَبْدِ اللَّهِ', id: 1, pp: 1, volume: 1 }], options);
                    expect(actual).toMatchObject([{ arabic: 'قَالَ أَبُو عَبْدِ اللَّهِ', from: 1 }]);
                });

                it('should also capture numeral + dash in same pattern', () => {
                    const actual = segmentPages([{ content: '١٢٣ - حديث', id: 1, pp: 1, volume: 1 }], options);
                    expect(actual).toMatchObject([{ arabic: '١٢٣ - حديث', from: 1 }]);
                });

                it('should also capture bullet in same pattern', () => {
                    const actual = segmentPages([{ content: '• نقطة مهمة', id: 1, pp: 1, volume: 1 }], options);
                    expect(actual).toMatchObject([{ arabic: '• نقطة مهمة', from: 1 }]);
                });
            });

            describe('[تم and [بسم patterns', () => {
                beforeEach(() => {
                    options = {
                        patternToOptions: {
                            '^((\\[بِسْمِ |\\[تم|بِسْمِ اللَّهِ|بسم الله).*)': {},
                        },
                    };
                });

                it('should capture [تم', () => {
                    const actual = segmentPages([{ content: '[تم الجزء الأول]', id: 1, pp: 1, volume: 1 }], options);
                    expect(actual).toMatchObject([{ arabic: '[تم الجزء الأول]', from: 1 }]);
                });

                it('should capture بسم الله', () => {
                    const actual = segmentPages([{ content: 'بسم الله نبدأ', id: 1, pp: 1, volume: 1 }], options);
                    expect(actual).toMatchObject([{ arabic: 'بسم الله نبدأ', from: 1 }]);
                });
            });

            describe('numeral slash numeral patterns', () => {
                it('should capture numeral/ numeral + dash', () => {
                    const actual = segmentPages([{ content: '١٢٣/ ٤٥٦ - حديث', id: 1, pp: 1, volume: 1 }], {
                        patternToOptions: { '^(([\\u0660-\\u0669]+/ [\\u0660-\\u0669]+\\s?[-–—ـ]).*)': {} },
                    });
                    expect(actual).toMatchObject([{ arabic: '١٢٣/ ٤٥٦ - حديث', from: 1 }]);
                });

                it('should capture °* numeral + dash', () => {
                    const actual = segmentPages([{ content: '°* ١٢٣ - حديث', id: 1, pp: 1, volume: 1 }], {
                        patternToOptions: { '^°\\*? (([\\u0660-\\u0669]+\\s?[-–—ـ]).*)': {} },
                    });
                    expect(actual).toMatchObject([{ arabic: '١٢٣ - حديث', from: 1 }]);
                });
            });
        });

        describe('prevEntryMarkerPattern with Arabic phrases', () => {
            it('should start new entry after التَّوْفِيقُ.', () => {
                const lines = ['النص الأول التَّوْفِيقُ.', 'النص الثاني'];
                const actual = segmentPages([{ content: lines.join('\r'), id: 1, pp: 1, volume: 1 }], {
                    overflow: 'punctuation',
                    prevEntryMarkerPattern: '(التَّوْفِيقُ|وَلِلَّهِ الْحَمْدُ|كُلِّ حَالٍ)\\.$',
                });

                expect(actual).toMatchObject([
                    { arabic: 'النص الأول التَّوْفِيقُ.', from: 1 },
                    { arabic: 'النص الثاني', from: 1 },
                ]);
            });

            it('should start new entry after وَلِلَّهِ الْحَمْدُ.', () => {
                const lines = ['الحمد لله وَلِلَّهِ الْحَمْدُ.', 'فصل جديد'];
                const actual = segmentPages([{ content: lines.join('\r'), id: 1, pp: 1, volume: 1 }], {
                    overflow: 'punctuation',
                    prevEntryMarkerPattern: '(التَّوْفِيقُ|وَلِلَّهِ الْحَمْدُ|كُلِّ حَالٍ)\\.$',
                });

                expect(actual).toMatchObject([
                    { arabic: 'الحمد لله وَلِلَّهِ الْحَمْدُ.', from: 1 },
                    { arabic: 'فصل جديد', from: 1 },
                ]);
            });

            it('should start new entry after والله أعلم.', () => {
                const lines = ['وهذا الصحيح والله أعلم.', 'مسألة أخرى'];
                const actual = segmentPages([{ content: lines.join('\r'), id: 1, pp: 1, volume: 1 }], {
                    overflow: 'punctuation',
                    prevEntryMarkerPattern: '(والله أعلم|التَّوْفِيقُ)\\.$',
                });

                expect(actual).toMatchObject([
                    { arabic: 'وهذا الصحيح والله أعلم.', from: 1 },
                    { arabic: 'مسألة أخرى', from: 1 },
                ]);
            });
        });

        describe('isMarkdown', () => {
            beforeEach(() => {
                options = { isMarkdown: true };
            });

            it('should capture lines starting with # as chapters', () => {
                // Note: slice(1) removes only the '#', leaving the space after it
                const actual = segmentPages([{ content: '#Chapter Title', id: 1, pp: 1, volume: 1 }], options);

                expect(actual).toMatchObject([{ arabic: 'Chapter Title', from: 1, id: 'C1', type: 2 }]);
            });

            it('should capture ## as chapter (first # removed, second # kept)', () => {
                const actual = segmentPages([{ content: '##Sub Chapter', id: 1, pp: 1, volume: 1 }], options);

                // First # is removed by captureMarkdownChapters, second # remains in the text
                // The patternToOptions '^#' pattern is added but doesn't match since ln.id is already set
                expect(actual).toMatchObject([{ arabic: '#Sub Chapter', from: 1, id: 'C1', type: 2 }]);
            });

            it('should capture multiple markdown headers on same page', () => {
                const lines = ['#First Chapter', '#Second Chapter'];
                const actual = segmentPages([{ content: lines.join('\r'), id: 1, pp: 1, volume: 1 }], options);

                expect(actual).toMatchObject([
                    { arabic: 'First Chapter', from: 1, type: 2 },
                    { arabic: 'Second Chapter', from: 1, type: 2 },
                ]);
            });

            it('should handle markdown chapters mixed with regular text', () => {
                // Note: once a chapter is captured, subsequent lines are appended to it
                const lines = ['#Chapter One', 'Regular text content'];
                const actual = segmentPages([{ content: lines.join('\r'), id: 1, pp: 1, volume: 1 }], options);

                expect(actual).toMatchObject([{ arabic: 'Chapter One\nRegular text content', from: 1, type: 2 }]);
            });

            it('should not capture # in the middle of text', () => {
                const actual = segmentPages(
                    [{ content: 'Some text #not a chapter', id: 1, pp: 1, volume: 1 }],
                    options,
                );

                expect(actual).toMatchObject([{ arabic: 'Some text #not a chapter', from: 1 }]);
                expect(actual[0]).not.toHaveProperty('type');
            });

            it('should capture chapter without space after #', () => {
                const actual = segmentPages([{ content: '#باب الصلاة', id: 1, pp: 1, volume: 1 }], options);

                expect(actual).toMatchObject([{ arabic: 'باب الصلاة', from: 1, type: 2 }]);
            });
        });

        describe('parseNumericChapters', () => {
            beforeEach(() => {
                options = { parseNumericChapters: true };
            });

            it('should flatten numeric chapter items and preserve text', () => {
                const actual = segmentPages(
                    [{ content: '<span data-type="title" id="toc-1">١- باب الصلاة</span>', id: 1, pp: 1, volume: 1 }],
                    options,
                );

                // With parseNumericChapters, the id should be removed and text should be captured
                expect(actual).toMatchObject([{ arabic: '١- باب الصلاة', from: 1 }]);
            });

            it('should capture Arabic numeral list item without id when parseNumericChapters is true', () => {
                const actual = segmentPages(
                    [{ content: '<span id="toc-1">٢- كتاب الزكاة</span>', id: 1, pp: 1, volume: 1 }],
                    options,
                );

                expect(actual).toMatchObject([{ arabic: '٢- كتاب الزكاة', from: 1 }]);
            });

            it('should NOT flatten when parseNumericChapters is false', () => {
                const actual = segmentPages(
                    [{ content: '<span data-type="title" id="toc-5">٣- باب الصيام</span>', id: 1, pp: 1, volume: 1 }],
                    { parseNumericChapters: false },
                );

                expect(actual).toMatchObject([{ arabic: 'باب الصيام', from: 1, index: 3, type: 2 }]);
            });
        });

        describe('replacements', () => {
            it('should apply single replacement pattern', () => {
                const actual = segmentPages([{ content: 'Hello World', id: 1, pp: 1, volume: 1 }], {
                    replacements: { World: 'Universe' },
                });

                expect(actual).toMatchObject([{ arabic: 'Hello Universe', from: 1 }]);
            });

            it('should apply multiple replacement patterns', () => {
                const actual = segmentPages([{ content: 'AAA BBB CCC', id: 1, pp: 1, volume: 1 }], {
                    replacements: { AAA: '111', BBB: '222', CCC: '333' },
                });

                expect(actual).toMatchObject([{ arabic: '111 222 333', from: 1 }]);
            });

            it('should apply regex-based replacements', () => {
                const actual = segmentPages([{ content: 'foo123bar456baz', id: 1, pp: 1, volume: 1 }], {
                    replacements: { '\\d+': '#' },
                });

                expect(actual).toMatchObject([{ arabic: 'foo#bar#baz', from: 1 }]);
            });

            it('should apply Arabic text replacements', () => {
                const actual = segmentPages([{ content: 'بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ', id: 1, pp: 1, volume: 1 }], {
                    replacements: { الرَّحِيمِ: 'الرحيم' },
                });

                expect(actual).toMatchObject([{ arabic: 'بِسْمِ اللَّهِ الرَّحْمَنِ الرحيم', from: 1 }]);
            });

            it('should remove text with empty replacement', () => {
                const actual = segmentPages([{ content: 'Remove [this] text', id: 1, pp: 1, volume: 1 }], {
                    replacements: { '\\[this\\] ': '' },
                });

                expect(actual).toMatchObject([{ arabic: 'Remove text', from: 1 }]);
            });

            it('should work with patternToOptions', () => {
                const actual = segmentPages([{ content: '١٢٣ - REPLACE_ME حديث', id: 1, pp: 1, volume: 1 }], {
                    patternToOptions: { '^([\\u0660-\\u0669]+\\s?[-–—ـ].*)': {} },
                    replacements: { REPLACE_ME: 'متن' },
                });

                expect(actual).toMatchObject([{ arabic: '١٢٣ - متن حديث', from: 1 }]);
            });
        });

        describe('lineSeparator', () => {
            it('should use default newline separator', () => {
                const actual = segmentPages([{ content: 'Line 1\rLine 2', id: 1, pp: 1, volume: 1 }]);

                expect(actual).toMatchObject([{ arabic: 'Line 1\nLine 2', from: 1 }]);
            });

            it('should use custom separator (space)', () => {
                const actual = segmentPages([{ content: 'Line 1\rLine 2', id: 1, pp: 1, volume: 1 }], {
                    lineSeparator: ' ',
                });

                expect(actual).toMatchObject([{ arabic: 'Line 1 Line 2', from: 1 }]);
            });

            it('should use custom separator (double newline)', () => {
                const actual = segmentPages([{ content: 'Para 1\rPara 2', id: 1, pp: 1, volume: 1 }], {
                    lineSeparator: '\n\n',
                });

                expect(actual).toMatchObject([{ arabic: 'Para 1\n\nPara 2', from: 1 }]);
            });

            it('should use custom separator (HTML break)', () => {
                const actual = segmentPages([{ content: 'Line 1\rLine 2', id: 1, pp: 1, volume: 1 }], {
                    lineSeparator: '<br>',
                });

                expect(actual).toMatchObject([{ arabic: 'Line 1<br>Line 2', from: 1 }]);
            });

            it('should use custom separator with multiple lines', () => {
                const actual = segmentPages([{ content: 'A\rB\rC\rD', id: 1, pp: 1, volume: 1 }], {
                    lineSeparator: ' | ',
                });

                expect(actual).toMatchObject([{ arabic: 'A | B | C | D', from: 1 }]);
            });

            it('should use empty string separator to join without delimiter', () => {
                const actual = segmentPages([{ content: 'A\rB\rC', id: 1, pp: 1, volume: 1 }], {
                    lineSeparator: '',
                });

                expect(actual).toMatchObject([{ arabic: 'ABC', from: 1 }]);
            });
        });

        describe('excludePagesWithPatterns', () => {
            it('should exclude pages matching a single pattern', () => {
                const actual = segmentPages(
                    [
                        { content: 'Normal page content', id: 1, pp: 1, volume: 1 },
                        { content: 'فهرس الكتاب', id: 2, pp: 2, volume: 1 },
                        { content: 'Another normal page', id: 3, pp: 3, volume: 1 },
                    ],
                    { excludePagesWithPatterns: ['فهرس'] },
                );

                expect(actual).toHaveLength(2);
                expect(actual).toMatchObject([
                    { arabic: 'Normal page content', from: 1 },
                    { arabic: 'Another normal page', from: 3 },
                ]);
            });

            it('should exclude pages matching multiple patterns', () => {
                const actual = segmentPages(
                    [
                        { content: 'Normal page', id: 1, pp: 1, volume: 1 },
                        { content: 'Table of Contents', id: 2, pp: 2, volume: 1 },
                        { content: 'Index page', id: 3, pp: 3, volume: 1 },
                        { content: 'Regular content', id: 4, pp: 4, volume: 1 },
                    ],
                    { excludePagesWithPatterns: ['Table of Contents', 'Index page'] },
                );

                expect(actual).toHaveLength(2);
                expect(actual).toMatchObject([
                    { arabic: 'Normal page', from: 1 },
                    { arabic: 'Regular content', from: 4 },
                ]);
            });

            it('should exclude pages matching regex patterns', () => {
                const actual = segmentPages(
                    [
                        { content: 'Page 1', id: 1, pp: 1, volume: 1 },
                        { content: 'Skip page 123', id: 2, pp: 2, volume: 1 },
                        { content: 'Skip page 456', id: 3, pp: 3, volume: 1 },
                        { content: 'Page 4', id: 4, pp: 4, volume: 1 },
                    ],
                    { excludePagesWithPatterns: ['Skip page \\d+'] },
                );

                expect(actual).toHaveLength(2);
                expect(actual).toMatchObject([
                    { arabic: 'Page 1', from: 1 },
                    { arabic: 'Page 4', from: 4 },
                ]);
            });

            it('should not exclude any pages when pattern does not match', () => {
                const actual = segmentPages(
                    [
                        { content: 'Page 1', id: 1, pp: 1, volume: 1 },
                        { content: 'Page 2', id: 2, pp: 2, volume: 1 },
                    ],
                    { excludePagesWithPatterns: ['nonexistent pattern'] },
                );

                expect(actual).toHaveLength(2);
            });

            it('should handle Arabic regex patterns', () => {
                const actual = segmentPages(
                    [
                        { content: 'محتوى عادي', id: 1, pp: 1, volume: 1 },
                        { content: 'الصفحة فارغة', id: 2, pp: 2, volume: 1 },
                        { content: 'المزيد من المحتوى', id: 3, pp: 3, volume: 1 },
                    ],
                    { excludePagesWithPatterns: ['فارغة'] },
                );

                expect(actual).toHaveLength(2);
                expect(actual).toMatchObject([
                    { arabic: 'محتوى عادي', from: 1 },
                    { arabic: 'المزيد من المحتوى', from: 3 },
                ]);
            });
        });

        describe('excludePages', () => {
            it('should exclude a single page by id', () => {
                const actual = segmentPages(
                    [
                        { content: 'Page 1', id: 1, pp: 1, volume: 1 },
                        { content: 'Page 2', id: 2, pp: 2, volume: 1 },
                        { content: 'Page 3', id: 3, pp: 3, volume: 1 },
                    ],
                    { excludePages: ['2'] },
                );

                expect(actual).toHaveLength(2);
                expect(actual).toMatchObject([
                    { arabic: 'Page 1', from: 1 },
                    { arabic: 'Page 3', from: 3 },
                ]);
            });

            it('should exclude multiple pages by id', () => {
                const actual = segmentPages(
                    [
                        { content: 'Page 1', id: 1, pp: 1, volume: 1 },
                        { content: 'Page 2', id: 2, pp: 2, volume: 1 },
                        { content: 'Page 3', id: 3, pp: 3, volume: 1 },
                        { content: 'Page 4', id: 4, pp: 4, volume: 1 },
                    ],
                    { excludePages: ['2', '4'] },
                );

                expect(actual).toHaveLength(2);
                expect(actual).toMatchObject([
                    { arabic: 'Page 1', from: 1 },
                    { arabic: 'Page 3', from: 3 },
                ]);
            });

            it('should exclude a range of pages', () => {
                const actual = segmentPages(
                    [
                        { content: 'Page 1', id: 1, pp: 1, volume: 1 },
                        { content: 'Page 2', id: 2, pp: 2, volume: 1 },
                        { content: 'Page 3', id: 3, pp: 3, volume: 1 },
                        { content: 'Page 4', id: 4, pp: 4, volume: 1 },
                        { content: 'Page 5', id: 5, pp: 5, volume: 1 },
                    ],
                    { excludePages: ['2-4'] },
                );

                expect(actual).toHaveLength(2);
                expect(actual).toMatchObject([
                    { arabic: 'Page 1', from: 1 },
                    { arabic: 'Page 5', from: 5 },
                ]);
            });

            it('should exclude mixed single pages and ranges', () => {
                const actual = segmentPages(
                    [
                        { content: 'Page 1', id: 1, pp: 1, volume: 1 },
                        { content: 'Page 2', id: 2, pp: 2, volume: 1 },
                        { content: 'Page 3', id: 3, pp: 3, volume: 1 },
                        { content: 'Page 4', id: 4, pp: 4, volume: 1 },
                        { content: 'Page 5', id: 5, pp: 5, volume: 1 },
                        { content: 'Page 6', id: 6, pp: 6, volume: 1 },
                    ],
                    { excludePages: ['1', '3-5'] },
                );

                expect(actual).toHaveLength(2);
                expect(actual).toMatchObject([
                    { arabic: 'Page 2', from: 2 },
                    { arabic: 'Page 6', from: 6 },
                ]);
            });

            it('should not exclude any pages when ids do not match', () => {
                const actual = segmentPages(
                    [
                        { content: 'Page 1', id: 1, pp: 1, volume: 1 },
                        { content: 'Page 2', id: 2, pp: 2, volume: 1 },
                    ],
                    { excludePages: ['99', '100-200'] },
                );

                expect(actual).toHaveLength(2);
            });

            it('should work with other options', () => {
                const actual = segmentPages(
                    [
                        { content: '١ - حديث أول', id: 1, pp: 1, volume: 1 },
                        { content: '٢ - حديث ثاني', id: 2, pp: 2, volume: 1 },
                        { content: '٣ - حديث ثالث', id: 3, pp: 3, volume: 1 },
                    ],
                    {
                        excludePages: ['2'],
                        patternToOptions: { '^([\\u0660-\\u0669]+\\s?[-–—ـ].*)': {} },
                    },
                );

                expect(actual).toHaveLength(2);
                expect(actual).toMatchObject([
                    { arabic: '١ - حديث أول', from: 1 },
                    { arabic: '٣ - حديث ثالث', from: 3 },
                ]);
            });
        });

        describe('aslPatches', () => {
            it('should apply a single patch to a page', () => {
                const actual = segmentPages([{ content: 'Original typo text', id: 1, pp: 1, volume: 1 }], {
                    aslPatches: [{ match: 'typo', page: 1, replacement: 'correct' }],
                });

                expect(actual).toMatchObject([{ arabic: 'Original correct text', from: 1 }]);
            });

            it('should apply multiple patches to same page', () => {
                const actual = segmentPages([{ content: 'Error1 and Error2 here', id: 1, pp: 1, volume: 1 }], {
                    aslPatches: [
                        { match: 'Error1', page: 1, replacement: 'Fix1' },
                        { match: 'Error2', page: 1, replacement: 'Fix2' },
                    ],
                });

                expect(actual).toMatchObject([{ arabic: 'Fix1 and Fix2 here', from: 1 }]);
            });

            it('should apply patches to different pages', () => {
                const actual = segmentPages(
                    [
                        { content: 'Page one mistake', id: 1, pp: 1, volume: 1 },
                        { content: 'Page two mistake', id: 2, pp: 2, volume: 1 },
                    ],
                    {
                        aslPatches: [
                            { match: 'mistake', page: 1, replacement: 'correction' },
                            { match: 'mistake', page: 2, replacement: 'fix' },
                        ],
                    },
                );

                expect(actual).toMatchObject([
                    { arabic: 'Page one correction', from: 1 },
                    { arabic: 'Page two fix', from: 2 },
                ]);
            });

            it('should apply regex-based patches', () => {
                const actual = segmentPages([{ content: 'Number 123 and 456', id: 1, pp: 1, volume: 1 }], {
                    aslPatches: [{ match: '\\d+', page: 1, replacement: '#' }],
                });

                expect(actual).toMatchObject([{ arabic: 'Number # and 456', from: 1 }]);
            });

            it('should apply Arabic text patches', () => {
                const actual = segmentPages([{ content: 'النص الخطأ هنا', id: 1, pp: 1, volume: 1 }], {
                    aslPatches: [{ match: 'الخطأ', page: 1, replacement: 'الصحيح' }],
                });

                expect(actual).toMatchObject([{ arabic: 'النص الصحيح هنا', from: 1 }]);
            });

            it('should remove text with empty replacement', () => {
                const actual = segmentPages([{ content: 'Remove [extra] this', id: 1, pp: 1, volume: 1 }], {
                    aslPatches: [{ match: '\\[extra\\] ', page: 1, replacement: '' }],
                });

                expect(actual).toMatchObject([{ arabic: 'Remove this', from: 1 }]);
            });

            it('should not affect pages without patches', () => {
                const actual = segmentPages(
                    [
                        { content: 'Page 1 unchanged', id: 1, pp: 1, volume: 1 },
                        { content: 'Page 2 has typo', id: 2, pp: 2, volume: 1 },
                        { content: 'Page 3 unchanged', id: 3, pp: 3, volume: 1 },
                    ],
                    { aslPatches: [{ match: 'typo', page: 2, replacement: 'fix' }] },
                );

                expect(actual).toMatchObject([
                    { arabic: 'Page 1 unchanged', from: 1 },
                    { arabic: 'Page 2 has fix', from: 2 },
                    { arabic: 'Page 3 unchanged', from: 3 },
                ]);
            });

            it('should work with patternToOptions', () => {
                const actual = segmentPages([{ content: '١٢٣ - حديص خطأ', id: 1, pp: 1, volume: 1 }], {
                    aslPatches: [{ match: 'حديص', page: 1, replacement: 'حديث' }],
                    patternToOptions: { '^([\\u0660-\\u0669]+\\s?[-–—ـ].*)': {} },
                });

                expect(actual).toMatchObject([{ arabic: '١٢٣ - حديث خطأ', from: 1 }]);
            });

            it('should apply patches before segmentation', () => {
                // The patch changes the content before pattern matching
                const actual = segmentPages([{ content: '• حديث', id: 1, pp: 1, volume: 1 }], {
                    aslPatches: [{ match: '• حديث', page: 1, replacement: '1 - حديث' }],
                    patternToOptions: { '^(\\d+ - .*)': {} },
                });

                expect(actual).toMatchObject([{ arabic: '1 - حديث', from: 1 }]);
            });
        });

        describe('combined options', () => {
            it('should work with excludePagesWithPatterns and excludePages together', () => {
                const actual = segmentPages(
                    [
                        { content: 'Normal page', id: 1, pp: 1, volume: 1 },
                        { content: 'Skip by pattern', id: 2, pp: 2, volume: 1 },
                        { content: 'Another page', id: 3, pp: 3, volume: 1 },
                        { content: 'Normal page 4', id: 4, pp: 4, volume: 1 },
                    ],
                    {
                        excludePages: ['4'],
                        excludePagesWithPatterns: ['Skip by pattern'],
                    },
                );

                expect(actual).toHaveLength(2);
                expect(actual).toMatchObject([
                    { arabic: 'Normal page', from: 1 },
                    { arabic: 'Another page', from: 3 },
                ]);
            });

            it('should work with aslPatches, replacements, and patternToOptions', () => {
                const actual = segmentPages([{ content: '١٢٣ - TYPO1 TYPO2', id: 1, pp: 1, volume: 1 }], {
                    aslPatches: [{ match: 'TYPO1', page: 1, replacement: 'FIX1' }],
                    patternToOptions: { '^([\\u0660-\\u0669]+\\s?[-–—ـ].*)': {} },
                    replacements: { TYPO2: 'FIX2' },
                });

                expect(actual).toMatchObject([{ arabic: '١٢٣ - FIX1 FIX2', from: 1 }]);
            });

            it('should work with isMarkdown and lineSeparator', () => {
                // Note: lines after the chapter header are appended to it with the custom separator
                const actual = segmentPages([{ content: '#Chapter\rLine 1\rLine 2', id: 1, pp: 1, volume: 1 }], {
                    isMarkdown: true,
                    lineSeparator: ' | ',
                });

                expect(actual).toMatchObject([{ arabic: 'Chapter | Line 1 | Line 2', from: 1, type: 2 }]);
            });

            it('should work with all filtering and patching options', () => {
                const actual = segmentPages(
                    [
                        { content: '١ - حديص أول', id: 1, pp: 1, volume: 1 },
                        { content: 'فهرس الكتاب', id: 2, pp: 2, volume: 1 },
                        { content: '٢ - حديث REPLACE ثاني', id: 3, pp: 3, volume: 1 },
                        { content: '٣ - حديث ثالث', id: 4, pp: 4, volume: 1 },
                    ],
                    {
                        aslPatches: [{ match: 'حديص', page: 1, replacement: 'حديث' }],
                        excludePages: ['4'],
                        excludePagesWithPatterns: ['فهرس'],
                        patternToOptions: { '^([\\u0660-\\u0669]+\\s?[-–—ـ].*)': {} },
                        replacements: { REPLACE: 'متن' },
                    },
                );

                expect(actual).toHaveLength(2);
                expect(actual).toMatchObject([
                    { arabic: '١ - حديث أول', from: 1 },
                    { arabic: '٢ - حديث متن ثاني', from: 3 },
                ]);
            });
        });
    });

    describe('mapLinesToTranslations', () => {
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

        it('should correct markers that were accidentally merged into a single line', () => {
            const actual = mapLinesToTranslations('P11 - Abcd P22 - 2 - Something. ');

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

        it('should correct escaped characters', () => {
            const actual = mapLinesToTranslations('P11 - \\[Abcd]');

            expect(actual).toMatchObject([
                {
                    id: 'P11',
                    text: '[Abcd]',
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
    });
});
