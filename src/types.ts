import type { Segment } from 'tafrigh';

export type Collection = { fid?: ForeignId[]; id: string; library?: number; title: string };

export type Config = {
    awsAccessKey: string;
    awsBucket: string;
    awsRegion: string;
    awsSecretKey: string;
    collectionsEndpoint: string;
    geminiApiKeys: string[];
    tafrighApiKeys: string;
};

export type ForeignId = { id: string; volume: number };

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
