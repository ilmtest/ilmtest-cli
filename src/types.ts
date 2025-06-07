import type { BoundingBox, Size, TextBlock } from 'kokokor';
import type { Segment } from 'paragrafs';

export type Collection = { fid?: ForeignId[] | string; id: string; title: string };

export type Config = {
    awsAccessKey: string;
    awsBucket: string;
    awsRegion: string;
    awsSecretKey: string;
    collectionsEndpoint: string;
    tafrighApiKeys: string;
};

export type ForeignId = { id: string; volume: number };

export type Manuscript = {
    contractVersion: string;
    createdAt: Date;
    data: {
        blocks: TextBlock[];
        lines?: BoundingBox[];
        page: number;
        rectangles?: BoundingBox[];
    }[];
    groundTruthUrls?: string[];
    lastUpdatedAt: Date;
    metadata: {
        image: Size;
        pdf: Size;
    };
    urlTemplate?: string;
};

export type Transcript = {
    readonly segments: Segment[];
    readonly timestamp: Date;
    readonly urls?: string[];
    readonly volume: number;
};

export type TranscriptSeries = {
    contractVersion: string;
    createdAt: Date;
    lastUpdatedAt: Date;
    transcripts: Transcript[];
};
