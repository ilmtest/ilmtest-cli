import path from 'node:path';
import { type Entry, EntryFlags } from '@/api/entries.js';
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

const loadTranslationFile = async (dir: string) => {
    const file = await getTranslationFile(dir, ['873', '879']);

    if (!file) {
        logger.warn(`No translation files found.`);
        return { translations: [], translator: 0 };
    }

    logger.info(`Using ${file.name}`);

    let text = await file.text();

    text = text.replace(/ ([CP]?\d+) -/gm, '\n$1 -');
    text = text.replace(/\\\[/gm, '[');

    const translations = mapLinesToTranslations(text);
    const [translator] = file.name!.split('/').at(-1)!.split('.').map(Number);

    return { translations, translator };
};

const mergeLoosePages = (entries: Entry[], prefix = 'P') => {
    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];

        if (entry.translation && entry.index) {
            // find every P id that doesn't have a translation and merge
            for (let j = i + 1; j < entries.length; j++) {
                const page = entries[j];

                if (page.id.startsWith(prefix) && !page.translation && !page.index) {
                    entry.arabic += ` ${page.arabic}`;

                    if (entry.from !== page.from) {
                        entry.to = page.from;
                    }

                    logger.info(`Adding to: ${entry.id}`);
                } else {
                    break;
                }
            }
        }
    }

    const leftover: Entry[] = [];

    for (const entry of entries) {
        if (entry.id.startsWith(prefix) && !entry.translation) {
            // skip
        } else {
            leftover.push(entry);
        }
    }

    return leftover;
};

/**
 * Compiles translation data for a collection by matching entries with translation files
 * @param collectionId - The ID of the collection to compile translations for
 * @returns Promise that resolves to an array of compiled translations
 */
export const compileTranslation = async (collectionId: string) => {
    const dir = path.join(OUTPUT_DIR, collectionId);
    const excerptFile = Bun.file(path.join(dir, 'excerpts.json'));
    const entries: Entry[] = await excerptFile.json();
    const { translations, translator } = await loadTranslationFile(dir);
    const idToEntries = Object.groupBy(entries, (e) => e.id);

    if (1 !== Number(1)) {
        const leftover = mergeLoosePages(entries);
        await excerptFile.write(JSON.stringify(leftover, null, 2));

        return;
    }

    for (const t of translations) {
        if (!idToEntries[t.id]) {
            logger.error(`${t.id} not found`);
        }

        const e = idToEntries[t.id]!.shift()!;

        if (!e) {
            logger.error(`${t.id} not found`);
        }

        if (!e.translation) {
            e.translation = t.text;
        } else if (!e.commentary) {
            e.commentary = t.text;
        }

        e.translator = translator;
        e.collection = Number(collectionId);
        e.flags = EntryFlags.PendingReview;
    }

    await excerptFile.write(JSON.stringify(entries, null, 2));
    logger.info(`${entries.length} saved to ${excerptFile.name}`);
};
