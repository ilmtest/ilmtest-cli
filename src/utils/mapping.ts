import type { Transcript as BahethTranscript } from 'baheth-sdk';
import type { Segment } from 'tafrigh';

import {
    estimateSegmentFromToken,
    formatSegmentsToTimestampedTranscript,
    mapSegmentsIntoFormattedSegments,
    markAndCombineSegments,
    Segment as ParagrafSegment,
} from 'paragrafs';

const FILLER_WORDS = ['آآ', 'اه', 'ايه', 'وآآ', 'مم', 'ها'].flatMap((token) => [token, token + '.', token + '?']);

type TranscriptData = { text?: string; timestamp?: Date; transcripts: Segment[]; url?: string };

export const mapSegmentsToTranscript = (transcripts: BahethTranscript | Segment[]): TranscriptData => {
    const result: TranscriptData = {
        transcripts: [],
    };

    if (Array.isArray(transcripts)) {
        result.transcripts = transcripts;
    } else {
        result.transcripts = (transcripts as BahethTranscript).segments.map(estimateSegmentFromToken);
        result.timestamp = transcripts.timestamp;
        result.url = transcripts.metadata.srtLink;
    }

    const combinedSegments = markAndCombineSegments(result.transcripts as ParagrafSegment[], {
        fillers: FILLER_WORDS,
        gapThreshold: 2,
        maxSecondsPerSegment: 240,
        minWordsPerSegment: 10,
    });

    const text = formatSegmentsToTimestampedTranscript(combinedSegments, 30);
    result.transcripts = mapSegmentsIntoFormattedSegments(combinedSegments, 30);

    return { ...result, text };
};
