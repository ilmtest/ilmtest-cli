import { Collection } from '../types.js';
import config from '../utils/config.js';
import { doGet, PagingParams } from './index.js';

interface GetCollectionsParams extends PagingParams {
    library?: string;
}
type RawCollection = { author_name: string; display_name: string; fid?: string; id: number };

const mapRawToCollection = (c: RawCollection): Collection => ({
    id: c.id.toString(),
    title: [c.display_name, c.author_name].filter(Boolean).join(', '),
});

export const getCollections = async (params: GetCollectionsParams = {}): Promise<Collection[]> => {
    const data: RawCollection[] = await doGet(config.collectionsEndpoint, params);

    return data.map(mapRawToCollection);
};

export const getCollection = async (id: string): Promise<Collection> => {
    const [data]: RawCollection[] = await doGet(config.collectionsEndpoint, { id });
    const result: Collection = mapRawToCollection(data);

    if (data.fid?.startsWith(`{"`) && data.fid?.endsWith('"}')) {
        const volumeToVideoId: Record<string, string> = JSON.parse(data.fid);

        result.fid = Object.entries(volumeToVideoId).map(([volume, videoId]) => ({
            id: videoId,
            volume: parseInt(volume),
        }));
    } else if (data.fid) {
        result.fid = [{ id: data.fid, volume: 1 }];
    }

    return result;
};
