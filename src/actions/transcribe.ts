import { select } from '@inquirer/prompts';

import { getCollection, getCollections } from '../api/collections.js';
import { ForeignId } from '../types.js';
import { downloadYouTubeVideo } from '../utils/downloader.js';

export const transcribeWithAI = async () => {
    const collections = await getCollections({ before: '9999', library: '62', limit: 10 });
    const selectedCollection = await select({
        choices: collections.map((c) => ({ description: c.id, name: c.title, value: c.id })),
        default: collections[0].id,
        message: 'Select collection',
    });
    const collection = await getCollection(selectedCollection);

    const [foreignId] = collection.fid as ForeignId[];
    const result = await downloadYouTubeVideo(foreignId.id, '1.mp4');

    console.log(result);
};
