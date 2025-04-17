import type { Segment } from 'tafrigh';

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

export type Part = { part: number; timestamp?: Date; transcripts: Segment[] };

export type Transcript = { parts: Part[]; timestamp: Date; urls: string[] };
