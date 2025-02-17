export type Collection = { fid?: ForeignId[] | string; id: string; title: string };

export type Config = { collectionsEndpoint: string; tafrighApiKeys: string };

export type ForeignId = { id: string; volume: number };
