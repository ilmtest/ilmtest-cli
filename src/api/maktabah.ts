import config from '../utils/config.js';
import { changeEndpointName, doGet } from './index.js';

/**
 * Bookmark data structure for navigation
 */
export type Bookmark = {
    level: number;
    page: number;
    title: string;
};

/**
 * Page data structure from Maktabah
 */
export type Page = {
    body: string;
    collection: string;
    id: number;
    page: number;
    pp: number;
    volume: number;
};

/**
 * Raw bookmark data as received from the API
 */
type RawBookmark = {
    id: number;
    level: number;
    page_id: number;
    title: string;
};

/**
 * Raw page data as received from the API
 */
type RawPage = {
    body: string;
    collection: string;
    id: number;
    page_number: number;
    part_number: number;
    part_page: number;
};

/**
 * Retrieves all pages for a given collection from Maktabah
 * @param collectionId - The ID of the collection to fetch pages for
 * @returns Promise that resolves to an array of Page objects sorted by page number
 */
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

/**
 * Retrieves all bookmarks for a given collection
 * @param collection - The collection ID to fetch bookmarks for
 * @returns Promise that resolves to an array of Bookmark objects
 */
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
