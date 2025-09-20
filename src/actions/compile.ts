import path from 'node:path';
import type { Entry } from '@/api/entries.js';
import { OUTPUT_DIR } from '@/utils/constants.js';
import logger from '@/utils/logger.js';
import { mapLinesToTranslations } from '@/utils/mapping.js';

/**
 * Finds a translation file from a list of possible names in a directory
 * @param dir - Directory path to search in
 * @param names - Array of possible file names (without extension)
 * @returns Promise that resolves to the first existing translation file, or undefined if none found
 */
const getTranslationFile = async (dir: string, names: string[]) => {
    for (const name of names) {
        const translationFile = Bun.file(path.format({ dir, ext: '.txt', name }));

        if (await translationFile.exists()) {
            return translationFile;
        }
    }
};

/**
 * Compiles translation data for a collection by matching entries with translation files
 * @param collectionId - The ID of the collection to compile translations for
 * @returns Promise that resolves to an array of compiled translations
 */
export const compileTranslation = async (collectionId: string) => {
    const dir = path.join(OUTPUT_DIR, collectionId);
    const entries: Entry[] = await Bun.file(path.join(dir, 'excerpts.json')).json();

    const file = await getTranslationFile(dir, ['873', '879', '153']);

    if (!file) {
        logger.warn(`No translation files found.`);
        return [];
    }

    logger.info(`Using ${file.name}`);

    const translations = mapLinesToTranslations(await file.text());
    const [translator] = file.name!.split('/').at(-1)!.split('.').map(Number);
    const idToEntries = Object.groupBy(entries, (e) => e.id);

    for (const t of translations) {
        if (!idToEntries[t.id]) {
            logger.error(`${t.id} not found`);
        }

        const e = idToEntries[t.id]!.shift()!;
        e.translation = t.text;
        e.translator = translator;
    }

    console.log('translations', JSON.stringify(entries, null, 2));
};
