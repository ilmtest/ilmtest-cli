import type { Token } from 'tafrigh';

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

export type Transcript = { timestamp: Date; tokens: Token[]; urls?: string[]; volume: number };

export type TranscriptSeries = {
    contractVersion: string;
    createdAt: Date;
    lastUpdatedAt: Date;
    transcripts: Transcript[];
};
