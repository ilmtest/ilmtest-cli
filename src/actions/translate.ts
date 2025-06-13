import { input } from '@inquirer/prompts';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { getEntries } from '../api/entries.js';
import { getPages } from '../api/maktabah.js';
import logger from '../utils/logger.js';

export const translateWithAI = async (targetCollection?: string) => {
    const collectionId =
        targetCollection ||
        (await input({
            message: 'Enter collection ID to translate:',
            required: true,
            validate: async (c) => {
                if (/^\d+$/.test(c)) {
                    return true;
                }

                return 'Please enter a valid collection ID';
            },
        }));

    await fs.mkdir(collectionId, { recursive: true });

    const pagesFile = Bun.file(path.format({ dir: collectionId, ext: '.json', name: 'pages' }));
    const entriesFile = Bun.file(path.format({ dir: collectionId, ext: '.json', name: 'entries' }));
    const translationFile = Bun.file(path.format({ dir: collectionId, ext: '.txt', name: 'translation' }));

    if (!(await pagesFile.exists())) {
        logger.info('Downloading pages');
        const pages = await getPages(collectionId);

        logger.info('Saving pages');
        await pagesFile.write(JSON.stringify(pages));
    }

    if (!(await entriesFile.exists())) {
        logger.info('Downloading entries');
        const entries = await getEntries(collectionId);

        logger.info('Saving entries');
        await entriesFile.write(JSON.stringify(entries));
    }

    if (!(await translationFile.exists())) {
        await Bun.file(path.format({ dir: collectionId, ext: '.txt', name: 'translation' })).write('');
    }
};
