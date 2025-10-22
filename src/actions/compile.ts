import path from 'node:path';
import { EntryFlags } from '@/api/entries.js';
import type { Excerpts } from '@/types.js';
import { getParsedArgs } from '@/utils/argsParser.js';
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

const loadTranslationFile = async (dir: string, forcedTranslator?: string) => {
    const file = await getTranslationFile(
        dir,
        ['873', '879'].filter((t) => !forcedTranslator || forcedTranslator === t),
    );

    if (!file) {
        logger.warn(`No translation files found.`);
        return { translations: [], translator: 0 };
    }

    logger.info(`Using ${file.name}`);

    const text = await file.text();
    const translations = mapLinesToTranslations(text);
    const [translator] = file.name!.split('/').at(-1)!.split('.').map(Number);

    logger.info(`Loaded ${translations.length} translations`);

    return { translations, translator };
};

/**
 * Compiles translation data for a collection by matching entries with translation files
 * @param collectionId - The ID of the collection to compile translations for
 * @returns Promise that resolves to an array of compiled translations
 */
export const compileTranslation = async (collectionId: string, pageRange: string) => {
    const { values: parsedValues } = getParsedArgs({ translator: { type: 'string' } });

    const [from = 1, to = Number.MAX_SAFE_INTEGER] = (pageRange?.split('-') || []).map(Number);
    const dir = path.join(OUTPUT_DIR, collectionId);
    const excerptFile = Bun.file(path.join(dir, 'excerpts.json'));
    const { excerpts: entries, ...rest } = (await excerptFile.json()) as Excerpts;
    const { translations, translator } = await loadTranslationFile(dir, parsedValues.translator as string);
    const idToEntries = Object.groupBy(
        entries.filter((e) => e.from >= from && e.from <= to),
        (e) => e.id,
    );

    let hasError = false;

    for (const t of translations) {
        if (!idToEntries[t.id]) {
            logger.error(`${t.id} not found`);
            console.error(t);
            hasError = true;
            continue;
        }

        const e = idToEntries[t.id]!.shift()!;

        if (!e) {
            logger.error(`No entries left for ${t.id}`);
            hasError = true;
            continue;
        }

        if (!e.translation) {
            e.translation = t.text;
        } else if (!e.commentary) {
            e.commentary = t.text;
            //throw new Error(`Duplicate ${t.id}`);
        }

        e.translator = translator;
        e.collection = Number(collectionId);
        e.flags = EntryFlags.PendingReview;
    }

    if (!hasError) {
        await excerptFile.write(
            JSON.stringify({ ...rest, excerpts: entries, lastUpdatedAt: Date.now() } satisfies Excerpts, null, 2),
        );
        logger.info(`${entries.length} saved to ${excerptFile.name}`);
    }
};
