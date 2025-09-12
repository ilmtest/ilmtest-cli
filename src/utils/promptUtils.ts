import path from 'node:path';

import { type Entry, EntryType } from '@/api/entries.js';

import { TRANSLATE_PROMPT, TYPE_MARKER } from './constants.js';
import logger from './logger.js';

const mapEntriesToPrompt = (entries: Partial<Entry>[]) => {
    const lines = entries.map((e) => {
        if (e.type === EntryType.Chapter) {
            return `C${e.index} - ${e.arabic}`;
        }

        if (Number(e.type) === TYPE_MARKER) {
            return `M${e.index} - ${e.arabic}`;
        }

        if (!e.index) {
            return `P${e.from} - ${e.arabic}`;
        }

        return `${e.index} - ${e.arabic}`;
    });

    return lines;
};

export const generatePrompt = async (dir: string, title: string, entries: Partial<Entry>[]) => {
    const promptFile = Bun.file(path.format({ dir, ext: '.txt', name: 'prompt' }));

    if (!(await promptFile.exists())) {
        logger.info(`Writing ${promptFile.name}...`);

        const stringifiedEntries = mapEntriesToPrompt(entries);

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
