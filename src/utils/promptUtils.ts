import path from 'node:path';

import type { Entry } from '@/api/entries.js';

import logger from './logger.js';

const TRANSLATE_PROMPT = [
    `You are a professional Arabic to English translator who specializes in Islāmic content.`,
    `You will be translating from the book: {{book}}.`,
    'Translate the following Arabic text into English with the highest level of accuracy preferring literal translations except when the context fits to translate by meaning.',
    'Carefully analyze the context to ensure the correct usage of Islamic technical terminology.',
    'Preserve full chains of narration and use ALA-LC transliteration only on the names of the narrators in the chain but not the textual content. "حَدَّثَنَا مُحَمَّدُ" would translate to "Muḥammad narrated to us". Translate chapter headings, poetry and verses as well.',
    'Translate "God" as Allah unless the Arabic is actually refering to an ilāh. Whenever صلى الله عليه وسلم is used translate it with ﷺ. There should be no Arabic characters in your response other than this one.',
    'Respond only in plain-text, no markdown or formatting. Keep the numeric prefixes (B1, C2, N33, P44, etc.) that appear in the beginning of each narration. Do NOT attempt to correct the numeric prefixes if they seem out of order or assume continuity from one to another.',
    'Revise your translation THREE times before sending it back:',
    'The first pass: Verify all translations are aligned with matching Arabic numeric markers.',
    'The second pass: The translations are accurate based on the overall context.',
    'The third pass: Any transliterations used are accurate.',
    'CRITICAL: Never format chapter headings into all uppercase.',
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

        const result = [
            TRANSLATE_PROMPT.join('\n').replace('{{book}}', title),
            '\n\n',
            stringifiedEntries.join('\n\n'),
        ].join('\n');

        await promptFile.write(result);

        return result;
    }
};
