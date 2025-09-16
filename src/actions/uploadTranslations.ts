import { magentaBright, yellow } from 'ansis';

import { addOrUpdateEntry, type Entry, EntryType } from '@/api/entries.js';
import logger from '@/utils/logger.js';

const loadTranslations = async (dir: string): Promise<Translation[]> => {
    /*
    let translations = await loadTranslations(dir);
    translations = removeDuplicateTranslations(translations);

    if (entriesToFilter) {
        translations = translations.filter((t) => t.index && entriesToFilter.includes(t.index));
    }

    let finalEntries = applyTranslationsToEntries(arabicOnlyEntries as Entry[], translations);
    finalEntries = patchArray(finalEntries, (e) => {
        return {
            collection: Number(collection.id),
            flags: EntryFlags.PendingReview,
            volume: e.volume || 1,
        };
    });

    console.log(finalEntries); */
};

export const saveEntries = async (entries: Entry[], isPreview: boolean) => {
    for (const entry of entries.toSorted((a, b) => a.from - b.from)) {
        if (entry.id) {
            logger.info(`Update ${JSON.stringify(entry, null, 2)}`);
        } else if (!entry.type) {
            logger.info(
                `Add new entry at page: ${magentaBright(entry.from)}${entry.to ? `-${magentaBright(entry.to)}` : ''} with index ${yellow(entry.index)}`,
            );
        } else if (entry.type === EntryType.Chapter) {
            logger.info(`Add new chapter at page: ${magentaBright(entry.from)}`);
        } else {
            logger.info(`Unknown entry type being added at: ${magentaBright(entry.from)}`);
        }

        if (isPreview) {
            logger.info(`Text: ${entry.translation}\n${entry.arabic}\n\n`);
        } else {
            await addOrUpdateEntry(entry);
        }
    }

    if (entries[0]?.url) {
        logger.info(`Using url: ${entries[0].url}`);
    }
};
