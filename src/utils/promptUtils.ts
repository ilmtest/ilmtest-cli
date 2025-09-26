import path from 'node:path';

import type { Entry } from '@/api/entries.js';

import logger from './logger.js';

const TRANSLATE_PROMPT = [
    `You are a professional Arabic to English translator who specializes in Islāmic content.`,
    `You will be translating from the book: {{book}}.`,
    'Translate the following Arabic text into English with the highest level of accuracy preferring literal translations except when the context fits to translate by meaning.',
    'Carefully analyze the context to ensure the correct usage of Islamic technical terminology.',
    'Preserve full chains of narration and use ALA-LC transliteration only on the names of the narrators in the chain but not the textual content nor words like "Ḥaddathanā". Translate chapter headings as well.',
    'Translate "God" as Allah unless the Arabic is actually refering to an ilāh. Whenever صلى الله عليه وسلم is used translate it with ﷺ.',
    'Respond only in plain-text, no markdown or formatting. Keep each narration in a single line without any line breaks within it except for poetry. Keep the numeric prefixes (P1, C1, 11, etc.) that appear in the beginning of each narration.',
    'Revise your translation 3 times before sending it to verify its accuracy.',
];

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
