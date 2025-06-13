import config from '../utils/config.js';
import { changeEndpointName, doGet } from './index.js';

export type Page = {
    body: string;
    id: number;
    page: number;
    pp: number;
    volume: number;
};

type RawPage = {
    body: string;
    id: number;
    page_number: number;
    part_number: number;
    part_page: number;
};

export const getPages = async (collectionId: string): Promise<Page[]> => {
    const data: RawPage[] = await doGet(changeEndpointName(config.collectionsEndpoint, 'maktabah_page'), {
        collection: collectionId,
        limit: -1,
    });

    return data
        .map((p) => ({ body: p.body, id: p.id, page: p.page_number, pp: p.part_page, volume: p.part_number }))
        .sort((a, b) => a.page - b.page);
};
