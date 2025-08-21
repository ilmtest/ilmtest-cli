import config from '../utils/config.js';
import { changeEndpointName, doGet } from './index.js';

export type Bookmark = {
    level: number;
    page: number;
    title: string;
};

export type Page = {
    body: string;
    collection: string;
    id: number;
    page: number;
    pp: number;
    volume: number;
};

type RawBookmark = {
    id: number;
    level: number;
    page_id: number;
    title: string;
};

type RawPage = {
    body: string;
    collection: string;
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
        .map((p) => ({
            body: p.body,
            collection: p.collection,
            id: p.id,
            page: p.page_number,
            pp: p.part_page,
            volume: p.part_number,
        }))
        .sort((a, b) => a.page - b.page);
};

export const getBookmarks = async (collection: string): Promise<Bookmark[]> => {
    const data: RawBookmark[] = await doGet(changeEndpointName(config.collectionsEndpoint, 'bookmarks'), {
        collection,
        limit: -1,
    });

    return data.map((b) => ({
        level: b.level,
        page: b.page_id,
        title: b.title,
    }));
};
