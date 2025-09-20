import type { Collection } from '../types.js';

import config from '../utils/config.js';
import { doGet, type PagingParams } from './index.js';

/**
 * Raw collection data structure from the API
 */
type RawCollection = { author_name: string; display_name: string; fid?: string; id: number; library?: number };

/**
 * Parameters for getting collections with optional library filtering
 */
interface GetCollectionsParams extends PagingParams {
    library?: string;
}

/**
 * Maps raw collection data from API to internal Collection format
 * @param c - Raw collection data from the API
 * @returns Mapped Collection object
 */
const mapRawToCollection = (c: RawCollection): Collection => ({
    id: c.id.toString(),
    title: [c.display_name, c.author_name].filter(Boolean).join(', '),
    ...(c.library && { library: c.library }),
});

/**
 * Retrieves a list of collections with optional filtering
 * @param params - Optional parameters for filtering and pagination
 * @returns Promise that resolves to an array of Collection objects
 */
export const getCollections = async (params: GetCollectionsParams = {}): Promise<Collection[]> => {
    const data: RawCollection[] = await doGet(config.collectionsEndpoint, params);

    return data.map(mapRawToCollection);
};

/**
 * Retrieves a single collection by ID with parsed foreign ID data
 * @param id - The collection ID to retrieve
 * @returns Promise that resolves to a Collection object with parsed FID data
 */
export const getCollection = async (id: string): Promise<Collection> => {
    const [data]: RawCollection[] = await doGet(config.collectionsEndpoint, { id });
    const result: Collection = mapRawToCollection(data);

    if (data.fid?.startsWith(`{"`) && data.fid?.endsWith('"}')) {
        const volumeToVideoId: Record<string, string> = JSON.parse(data.fid);

        result.fid = Object.entries(volumeToVideoId)
            .map(([volume, videoId]) => ({
                id: videoId,
                volume: parseInt(volume),
            }))
            .toSorted((a, b) => a.volume - b.volume);
    } else if (data.fid) {
        result.fid = [{ id: data.fid, volume: 1 }];
    }

    return result;
};
