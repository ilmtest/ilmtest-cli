import type { Transcript as BahethTranscript } from 'baheth-sdk';
import type { Segment } from 'tafrigh';

import {
    createHints,
    estimateSegmentFromToken,
    formatSegmentsToTimestampedTranscript,
    mapSegmentsIntoFormattedSegments,
    markAndCombineSegments,
    Segment as ParagrafSegment,
} from 'paragrafs';

const FILLER_WORDS = ['آآ', 'اه', 'ايه', 'وآآ', 'فآآ', 'مم', 'ها'].flatMap((token) => [
    token,
    token + '.',
    token + '?',
]);

const HINTS = [
    'احسن الله اليكم',
    'جزاك الله',
    'احسن الله اليك',
    'بسم الله الرحمن',
    'وصلى الله وسلم على نبينا محمد',
    'اما بعد',
];

type TranscriptData = { text?: string; timestamp?: Date; transcripts: Segment[]; url?: string };

export const mapSegmentsToTranscript = (transcripts: BahethTranscript | Segment[]): TranscriptData => {
    const result: TranscriptData = {
        transcripts: [],
    };

    if (Array.isArray(transcripts)) {
        result.transcripts = transcripts.map(({ tokens, ...t }) => ({
            ...t,
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            tokens: tokens!.map(({ confidence, ...token }) => token),
        }));
    } else {
        result.transcripts = (transcripts as BahethTranscript).segments.map(estimateSegmentFromToken);
        result.timestamp = transcripts.timestamp;
        result.url = transcripts.metadata.srtLink;
    }

    const combinedSegments = markAndCombineSegments(result.transcripts as ParagrafSegment[], {
        fillers: FILLER_WORDS,
        gapThreshold: 2,
        hints: createHints(...HINTS),
        maxSecondsPerSegment: 240,
        minWordsPerSegment: 10,
    });

    const text = formatSegmentsToTimestampedTranscript(combinedSegments, 30);
    result.transcripts = mapSegmentsIntoFormattedSegments(combinedSegments, 30);

    return { ...result, text };
};
