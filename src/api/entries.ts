import config from '../utils/config.js';
import { changeEndpointName, doGet } from './index.js';

export type Entry = {
    arabic?: string;
    flags?: number;
    from: number;
    id: number;
    index?: number;
    pp: number;
    translation?: string;
    volume: number;
};

type RawEntry = {
    body: string;
    flags?: string;
    from_page: string;
    id: number;
    index_number?: number;
    part_number: number;
    part_page: number;
};

export const getEntries = async (collectionId: string): Promise<Entry[]> => {
    const data: RawEntry[] = await doGet(changeEndpointName(config.collectionsEndpoint, 'entries'), {
        collection: collectionId,
        limit: 999999,
    });

    return data.map((e) => ({
        from: Number(e.from_page),
        id: e.id,
        pp: e.part_page,
        translation: e.body,
        volume: e.part_number,
        ...(e.flags && { flags: Number(e.flags) }),
        ...(e.index_number && { index: e.index_number }),
    }));
};
