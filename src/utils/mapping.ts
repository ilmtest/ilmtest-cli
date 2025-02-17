import { type Segment as BahethSegment, Transcript as BahethTranscript } from 'baheth-sdk';
import { type Transcript as TafrighTranscript } from 'tafrigh';

import { Segment } from '../types.js';

const isSentenceEnding = (text: string) => /[.؟?]$/.test(text);
const filterFillerWords = (token: string) => token && !['آآ', 'اه', 'ايه', 'ايه.', 'وآآ'].includes(token);

const mapSegmentToEstimatedWords = ({ end, start, text }: BahethSegment): BahethSegment[] => {
    const tokens = text.split(/\s+/).filter(filterFillerWords);
    const totalTokens = tokens.length;
    const segmentDuration = end - start;
    const tokenDuration = segmentDuration / totalTokens;

    return tokens.map((word, i) => ({
        end: start + (i + 1) * tokenDuration,
        start: start + i * tokenDuration,
        text: word,
    }));
};

const groupWordsIntoSegments = (words: BahethSegment[], maxSecondsPerTranscript: number): Segment[] => {
    const transcripts: Segment[] = [];
    let currentTranscriptWords: BahethSegment[] = [];
    let transcriptStart = 0;

    words.forEach((word) => {
        if (currentTranscriptWords.length === 0) {
            transcriptStart = word.start;
        }
        currentTranscriptWords.push(word);
        const transcriptDuration = word.end - transcriptStart;

        // If the current group exceeds the max duration AND the current word ends a sentence, complete the transcript.
        if (transcriptDuration >= maxSecondsPerTranscript && isSentenceEnding(word.text)) {
            transcripts.push({
                body: currentTranscriptWords.map((w) => w.text).join(' '),
                end: word.end,
                start: transcriptStart,
                words: currentTranscriptWords,
            });
            // Reset for the next transcript group.
            currentTranscriptWords = [];
            transcriptStart = 0;
        }
    });

    // If any words remain, add them as the final transcript.
    if (currentTranscriptWords.length > 0) {
        transcripts.push({
            body: currentTranscriptWords.map((w) => w.text).join(' '),
            end: currentTranscriptWords[currentTranscriptWords.length - 1].end,
            start: transcriptStart,
            words: currentTranscriptWords,
        });
    }

    return transcripts;
};

export const mapBahethSegments = (segments: BahethSegment[], maxSecondsPerTranscript = 240): Segment[] => {
    // First pass: create a word-by-word transcript from segments.
    const words = segments.flatMap(mapSegmentToEstimatedWords);
    const transcriptSegments = groupWordsIntoSegments(words, maxSecondsPerTranscript);

    return transcriptSegments;
};

export const mapTafrighSegment = (t: TafrighTranscript): Segment => {
    return {
        body: t.text,
        end: t.range.end,
        start: t.range.start,
        words: (t.tokens || []).map((token) => ({ end: token.end, start: token.start, text: token.token })),
    };
};

type TranscriptData = { timestamp?: Date; transcripts: Segment[]; url?: string };

export const mapSegmentsToTranscript = (transcripts: BahethTranscript | TafrighTranscript[]): TranscriptData => {
    if (Array.isArray(transcripts)) {
        return { transcripts: transcripts.map(mapTafrighSegment) };
    } else {
        const bahethTranscript = transcripts as BahethTranscript;
        const segments = mapBahethSegments(bahethTranscript.segments);

        return { timestamp: bahethTranscript.timestamp, transcripts: segments, url: bahethTranscript.metadata.srtLink };
    }
};
