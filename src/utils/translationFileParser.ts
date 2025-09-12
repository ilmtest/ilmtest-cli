import { isAllUppercase, toTitleCase } from 'bitaboom';
import path from 'node:path';

import { Entry, EntryType } from '@/api/entries.js';
import { getEntryKey } from '@/utils/entryUtils.js';

import { TYPE_MARKER } from './constants.js';
import logger from './logger.js';
import { PATTERNS } from './textUtils.js';

const getTranslationFile = async (dir: string, names: string[]) => {
    for (const name of names) {
        const translationFile = Bun.file(path.format({ dir, ext: '.txt', name }));

        if (await translationFile.exists()) {
            return translationFile;
        }
    }
};

export type Translation = Pick<Entry, 'index' | 'translation' | 'translator' | 'type'> & Pick<Partial<Entry>, 'from'>;

export const loadTranslations = async (dir: string): Promise<Translation[]> => {
    const file = await getTranslationFile(dir, ['873', '879', '153']);

    if (!file) {
        logger.warn(`No translation files found.`);
        return [];
    }

    logger.info(`Using ${file.name}`);

    const translations: Translation[] = [];
    const lines = (await file.text())
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

    for (const line of lines) {
        let [, index, text] = line.match(/^C(\d+)\s?[-–—ـ](.*)/) || [];

        if (index && text) {
            translations.push({
                index: parseInt(index),
                translation: isAllUppercase(text) ? toTitleCase(text) : text,
                type: EntryType.Chapter,
            });
            continue;
        }

        [, index, text] = line.match(/^M(\d+)\s?[-–—ـ](.*)/) || [];

        if (index && text) {
            translations.push({
                index: parseInt(index),
                translation: text,
                type: TYPE_MARKER as EntryType,
            });
            continue;
        }

        [, index, text] = line.match(/^P(\d+)\s?[-–—ـ](.*)/) || [];

        if (index && text) {
            translations.push({ from: parseInt(index), translation: text });
            continue;
        }

        [, index, text] = line.match(PATTERNS.MatchNumericListItem) || [];

        if (index && text) {
            translations.push({ index: parseInt(index), translation: text });
            continue;
        }

        translations.at(-1)!.translation += '\n' + line;
    }

    const [translator] = file.name!.split('/').at(-1)!.split('.').map(Number);
    return translations.map(({ translation, ...t }) => ({ ...t, translation: translation!.trim(), translator }));
};

export const removeDuplicateTranslations = (translations: Translation[]) => {
    const result: Translation[] = [];
    const keyToTranslation: Record<string, Translation> = {};

    for (const translation of translations) {
        const key = getEntryKey(translation);

        if (keyToTranslation[key]) {
            keyToTranslation[key].translation += '\n\n' + translation.translation;
        } else {
            result.push(translation);
            keyToTranslation[key] = translation;
        }
    }

    return result;
};
