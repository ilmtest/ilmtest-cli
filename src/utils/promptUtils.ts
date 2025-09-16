import path from 'node:path';

import type { Entry } from '@/api/entries.js';

import { TRANSLATE_PROMPT } from './constants.js';
import logger from './logger.js';

export const generatePrompt = async (dir: string, title: string, entries: Partial<Entry>[]) => {
    const promptFile = Bun.file(path.format({ dir, ext: '.txt', name: 'prompt' }));

    if (!(await promptFile.exists())) {
        logger.info(`Writing ${promptFile.name}...`);

        const stringifiedEntries = entries.map((e) => `${e.id} - ${e.arabic}`);
        const errors = stringifiedEntries.filter((s) => s.includes('span'));

        if (errors.length) {
            logger.warn(`Errors found: ${errors.join('\n')}`);
        }

        await promptFile.write(
            [TRANSLATE_PROMPT.join('\n').replace('{{book}}', title), '\n\n', stringifiedEntries.join('\n\n')].join(
                '\n',
            ),
        );
    }
};
