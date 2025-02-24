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

export type Segment = { body: string; end: number; start: number; words: Word[] };

export type Transcript = { parts: Part[]; timestamp: Date; urls: string[] };

export type Word = { end: number; start: number; text: string };
