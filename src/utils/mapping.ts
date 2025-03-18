import { type Segment as BahethSegment, Transcript as BahethTranscript } from 'baheth-sdk';
import { type Token } from 'tafrigh';

import { Segment } from '../types.js';

type TafrighTranscript = { end: number; start: number; text: string; tokens: Token[] };

const FILLER_WORDS = ['آآ', 'اه', 'ايه', 'ايه.', 'وآآ'];
const FILLER_REGEX = new RegExp(FILLER_WORDS.join('|'), 'g');
const isSentenceEnding = (text: string) => /[.؟?]$/.test(text);
const filterFillerWords = (token: string) => token && !FILLER_WORDS.includes(token);

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

const mapBahethSegments = (segments: BahethSegment[], maxSecondsPerTranscript = 240): Segment[] => {
    // First pass: create a word-by-word transcript from segments.
    const words = segments.flatMap(mapSegmentToEstimatedWords);
    const transcriptSegments = groupWordsIntoSegments(words, maxSecondsPerTranscript);

    return transcriptSegments;
};

const mapTafrighSegment = (t: TafrighTranscript): Segment => {
    return {
        body: t.text.replace(FILLER_REGEX, '').replace(/ +/g, ' '),
        end: t.end,
        start: t.start,
        words: (t.tokens || [])
            .filter((token) => filterFillerWords(token.token))
            .map((token) => ({ end: token.end, start: token.start, text: token.token })),
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
