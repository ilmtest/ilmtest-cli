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

            // Expect timestamp and URL to be passed through
            expect(result.timestamp).toEqual(timestamp);
            expect(result.url).toEqual('http://example.com/srt');

            // There should be one transcript segment
            expect(result.transcripts).toHaveLength(1);

            const transcript = result.transcripts[0];
            expect(transcript.body).toEqual('Hello world.');
            expect(transcript.start).toBe(0);
            expect(transcript.end).toBe(2);

            // The segment text "Hello world." is split into two words:
            // "Hello" from 0 to 1 and "world." from 1 to 2.
            expect(transcript.words).toHaveLength(2);
            expect(transcript.words[0]).toEqual({ end: 1, start: 0, text: 'Hello' });
            expect(transcript.words[1]).toEqual({ end: 2, start: 1, text: 'world.' });
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

        expect(result.transcripts).toHaveLength(1);
        const transcript = result.transcripts[0];
        // The expected body should not include the filler word.
        expect(transcript.body).toEqual('Hello world.');
        expect(transcript.words).toHaveLength(2);
        expect(transcript.words[0]).toEqual({ end: 1.5, start: 0, text: 'Hello' });
        expect(transcript.words[1]).toEqual({ end: 3, start: 1.5, text: 'world.' });
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

        // Expect two separate transcript segments to have been created.
        expect(result.transcripts).toHaveLength(2);

        // First transcript group
        const transcript1 = result.transcripts[0];
        expect(transcript1.body).toEqual('First sentence.');
        expect(transcript1.start).toBe(0);
        expect(transcript1.end).toBe(250);
        expect(transcript1.words).toHaveLength(2);

        // Second transcript group
        const transcript2 = result.transcripts[1];
        expect(transcript2.body).toEqual('Second sentence.');
        expect(transcript2.start).toBe(250);
        expect(transcript2.end).toBe(500);
        expect(transcript2.words).toHaveLength(2);
    });

    it('should map a Tafrigh transcript array correctly', () => {
        const tafrighTranscripts = [
            {
                end: 20,
                start: 10,
                text: 'This is a اه test',
                tokens: [
                    { confidence: 0.95, end: 12, start: 10, token: 'This' },
                    { confidence: 0.95, end: 14, start: 12, token: 'is' },
                    { confidence: 0.95, end: 16, start: 14, token: 'a' },
                    { confidence: 0.95, end: 18, start: 17, token: 'اه' },
                    { confidence: 0.95, end: 20, start: 16, token: 'test' },
                ],
            },
        ];

        const result = mapSegmentsToTranscript(tafrighTranscripts);

        // In this branch, no timestamp or URL should be set.
        expect(result.timestamp).toBeUndefined();
        expect(result.url).toBeUndefined();
        expect(result.transcripts).toHaveLength(1);

        const transcript = result.transcripts[0];
        expect(transcript.body).toEqual('This is a test');
        expect(transcript.start).toBe(10);
        expect(transcript.end).toBe(20);

        // Each token should be mapped to a word.
        expect(transcript.words).toHaveLength(4);
        expect(transcript.words[0]).toEqual({ end: 12, start: 10, text: 'This' });
        expect(transcript.words[1]).toEqual({ end: 14, start: 12, text: 'is' });
        expect(transcript.words[2]).toEqual({ end: 16, start: 14, text: 'a' });
        expect(transcript.words[3]).toEqual({ end: 20, start: 16, text: 'test' });
    });

    it("should handle multiple spaces and line breaks in a Baheth segment's text correctly", () => {
        const timestamp = new Date('2025-02-17T00:00:00Z');
        const bahethTranscript = {
            metadata: { description: '', srtLink: 'http://example.com/srt', videoUrl: '' },
            segments: [{ end: 2, start: 0, text: 'hello \n world' }],
            timestamp,
        };

        const result = mapSegmentsToTranscript(bahethTranscript);

        expect(result.transcripts).toHaveLength(1);
        const transcript = result.transcripts[0];
        // Extra spaces should be collapsed, resulting in "hello world"
        expect(transcript.body).toEqual('hello world');
        expect(transcript.words).toHaveLength(2);
        expect(transcript.words[0]).toEqual({ end: 1, start: 0, text: 'hello' });
        expect(transcript.words[1]).toEqual({ end: 2, start: 1, text: 'world' });
    });
});
