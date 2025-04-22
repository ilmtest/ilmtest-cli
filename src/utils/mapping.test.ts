import { describe, expect, it } from 'bun:test';

import { mapSegmentsToTranscript } from './mapping';

describe('mapping', () => {
    describe('mapSegmentsToTranscript', () => {
        it('should map a simple Baheth transcript (single segment) correctly', () => {
            const timestamp = new Date('2025-02-17T00:00:00Z');
            const bahethTranscript = {
                metadata: { description: '', srtLink: 'http://example.com/srt', videoUrl: '' },
                segments: [{ end: 2, start: 0, text: 'Hello world.' }],
                timestamp,
            };

            const result = mapSegmentsToTranscript(bahethTranscript);

            expect(result).toEqual({
                text: '0:00: Hello world.',
                timestamp,
                transcripts: [
                    {
                        end: 2,
                        start: 0,
                        text: 'Hello world.',
                        tokens: [
                            {
                                end: 1,
                                start: 0,
                                text: 'Hello',
                            },
                            {
                                end: 2,
                                start: 1,
                                text: 'world.',
                            },
                        ],
                    },
                ],
                url: 'http://example.com/srt',
            });
        });
    });

    it('should filter filler words from a Baheth transcript', () => {
        const timestamp = new Date('2025-02-17T00:00:00Z');
        // The filler word "اه" should be removed.
        const bahethTranscript = {
            metadata: { description: '', srtLink: 'http://example.com/srt', videoUrl: '' },
            segments: [{ end: 3, start: 0, text: 'Hello اه world.' }],
            timestamp,
        };

        const result = mapSegmentsToTranscript(bahethTranscript);

        expect(result).toEqual(
            expect.objectContaining({
                text: '0:00: Hello world.',
                transcripts: [
                    {
                        end: 3,
                        start: 0,
                        text: 'Hello world.',
                        tokens: [
                            {
                                end: 1,
                                start: 0,
                                text: 'Hello',
                            },
                            {
                                end: 3,
                                start: 2,
                                text: 'world.',
                            },
                        ],
                    },
                ],
            }),
        );
    });

    it('should filter filler words from tafrigh transcript', () => {
        const result = mapSegmentsToTranscript([
            {
                end: 10,
                start: 0,
                text: 'العشرية اه. هي الاحرف دمراه.',
                tokens: [
                    { end: 1, start: 0, text: 'العشرية' },
                    { end: 2, start: 1.5, text: 'اه.' },
                    { end: 4, start: 3, text: 'هي' },
                    { end: 7, start: 5, text: 'الاحرف' },
                    { end: 10, start: 9, text: 'دمراه.' },
                ],
            },
        ]);

        expect(result).toEqual({
            text: '0:00: العشرية هي الاحرف دمراه.',
            transcripts: [
                {
                    end: 10,
                    start: 0,
                    text: 'العشرية هي الاحرف دمراه.',
                    tokens: [
                        {
                            end: 1,
                            start: 0,
                            text: 'العشرية',
                        },
                        {
                            end: 4,
                            start: 3,
                            text: 'هي',
                        },
                        {
                            end: 7,
                            start: 5,
                            text: 'الاحرف',
                        },
                        {
                            end: 10,
                            start: 9,
                            text: 'دمراه.',
                        },
                    ],
                },
            ],
        });
    });

    it('should group words into multiple transcript segments when duration threshold is met', () => {
        const timestamp = new Date('2025-02-17T00:00:00Z');
        // We'll create two segments whose words, when estimated, cross the 240-second threshold.
        // Each segment is long enough that after processing its tokens, the transcript duration (250s)
        // exceeds the default maxSecondsPerTranscript (240) and the last word ends with punctuation.
        const bahethTranscript = {
            metadata: { description: '', srtLink: 'http://example.com/srt', videoUrl: '' },
            segments: [
                { end: 250, start: 0, text: 'First sentence.' },
                { end: 500, start: 250, text: 'Second sentence.' },
            ],
            timestamp,
        };

        const result = mapSegmentsToTranscript(bahethTranscript);

        expect(result).toEqual(
            expect.objectContaining({
                text: '0:00: First sentence.\n4:10: Second sentence.',
                transcripts: [
                    {
                        end: 500,
                        start: 0,
                        text: 'First sentence.\nSecond sentence.',
                        tokens: [
                            {
                                end: 125,
                                start: 0,
                                text: 'First',
                            },
                            {
                                end: 250,
                                start: 125,
                                text: 'sentence.',
                            },
                            {
                                end: 375,
                                start: 250,
                                text: 'Second',
                            },
                            {
                                end: 500,
                                start: 375,
                                text: 'sentence.',
                            },
                        ],
                    },
                ],
            }),
        );
    });

    it('should map a Tafrigh transcript array correctly', () => {
        const tafrighTranscripts = [
            {
                end: 20,
                start: 10,
                text: 'This is a اه test',
                tokens: [
                    { confidence: 0.95, end: 12, start: 10, text: 'This' },
                    { confidence: 0.95, end: 14, start: 12, text: 'is' },
                    { confidence: 0.95, end: 16, start: 14, text: 'a' },
                    { confidence: 0.95, end: 18, start: 17, text: 'اه' },
                    { confidence: 0.95, end: 20, start: 16, text: 'test' },
                ],
            },
        ];

        const result = mapSegmentsToTranscript(tafrighTranscripts);

        expect(result).toEqual({
            text: '0:10: This is a test',
            transcripts: [
                {
                    end: 20,
                    start: 10,
                    text: 'This is a test',
                    tokens: [
                        {
                            end: 12,
                            start: 10,
                            text: 'This',
                        },
                        {
                            end: 14,
                            start: 12,
                            text: 'is',
                        },
                        {
                            end: 16,
                            start: 14,
                            text: 'a',
                        },
                        {
                            end: 20,
                            start: 16,
                            text: 'test',
                        },
                    ],
                },
            ],
        });
    });

    it("should handle multiple spaces and line breaks in a Baheth segment's text correctly", () => {
        const timestamp = new Date('2025-02-17T00:00:00Z');
        const bahethTranscript = {
            metadata: { description: '', srtLink: 'http://example.com/srt', videoUrl: '' },
            segments: [{ end: 2, start: 0, text: 'hello \n world' }],
            timestamp,
        };

        const result = mapSegmentsToTranscript(bahethTranscript);

        expect(result).toEqual(
            expect.objectContaining({
                text: '0:00: hello world',
                transcripts: [
                    {
                        end: 2,
                        start: 0,
                        text: 'hello world',
                        tokens: [
                            {
                                end: 1,
                                start: 0,
                                text: 'hello',
                            },
                            {
                                end: 2,
                                start: 1,
                                text: 'world',
                            },
                        ],
                    },
                ],
            }),
        );
    });
});
