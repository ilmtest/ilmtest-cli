import path from 'node:path';
import { confirm } from '@inquirer/prompts';
import { type Entry, EntryFlags } from '@/api/entries.js';
import type { Excerpts, Translation } from '@/types.js';
import { getParsedArgs } from '@/utils/argsParser.js';
import { OUTPUT_DIR } from '@/utils/constants.js';
import logger from '@/utils/logger.js';
import { mapLinesToTranslations } from '@/utils/mapping.js';

const TRANSLATION_IDS = [873, 879];

type AITranslation = Translation & { translator: number };

const loadTranslations = async (dir: string) => {
    const translations: AITranslation[] = [];

    for (const translator of TRANSLATION_IDS) {
        const file = Bun.file(path.format({ dir, ext: '.txt', name: translator.toString() }));

        if (await file.exists()) {
            const text = await file.text();
            const newTranslations = mapLinesToTranslations(text).map((t) => ({ ...t, translator }));

            logger.info(`Loaded ${newTranslations.length} translations from ${file.name}`);

            translations.push(...newTranslations);
        }
    }

    return translations;
};

const mergeShortEntriesWithPrevious = (entries: Entry[], minWords: number, separator: string): Entry[] => {
    return entries.reduce<Entry[]>((acc, entry) => {
        const wordCount = entry.arabic!.trim().split(/\s+/).length;
        const prev = acc.at(-1);

        const shouldMerge = wordCount < minWords && !entry.to && prev?.from === entry.from && !prev.to;

        if (shouldMerge) {
            return [
                ...acc.slice(0, -1),
                {
                    ...prev,
                    arabic: `${prev.arabic}${separator}${entry.arabic}`,
                    translation: `${prev.translation}${separator}${entry.translation}`,
                },
            ];
        }

        return [...acc, entry];
    }, []);
};

/**
 * Compiles translation data for a collection by matching entries with translation files
 * @param collectionId - The ID of the collection to compile translations for
 * @returns Promise that resolves to an array of compiled translations
 */
export const compileTranslation = async (collectionId: string) => {
    const { values: parsedValues } = getParsedArgs({
        duplicates: { type: 'boolean' },
        pages: { type: 'string' },
        show: { type: 'boolean' },
    });

    const [from = 1, to = Number.MAX_SAFE_INTEGER] = ((parsedValues.pages as string)?.split('-') || []).map(Number);
    const dir = path.join(OUTPUT_DIR, collectionId);
    const excerptFile = Bun.file(path.join(dir, 'excerpts.json'));
    const { excerpts: entries, ...rest } = (await excerptFile.json()) as Excerpts;
    const translations = await loadTranslations(dir);

    logger.info(`Loaded ${translations.length} translations in total`);

    const idToEntries = Object.groupBy(
        entries.filter((e) => e.from >= from && e.from <= to),
        (e) => e.id,
    );

    let hasError = false;

    for (const t of translations) {
        if (!idToEntries[t.id]) {
            logger.error(`${t.id} not found for ${t.translator}`);
            console.error(t);
            hasError = true;
            continue;
        }

        const e = idToEntries[t.id]!.shift()!;

        if (!e) {
            logger.error(`No entries left for ${t.id} for ${t.translator}`);
            hasError = true;
            continue;
        }

        if (!e.translation) {
            e.translation = t.text;
        } else if (!e.commentary) {
            e.commentary = t.text;

            if (parsedValues.duplicates) {
                logger.warn(`Adding commentary for ${t.id}, translator: ${t.translator}`);
            } else {
                hasError = true;
                logger.error(`Duplicate ${t.id}, translator: ${t.translator}`);
            }
        }

        e.translator = t.translator;
        e.collection = Number(collectionId);
        e.flags = EntryFlags.PendingReview;
        e.lastUpdatedAt = Date.now();
    }

    if (!hasError) {
        await excerptFile.write(
            JSON.stringify({ ...rest, excerpts: entries, lastUpdatedAt: Date.now() } satisfies Excerpts, null, 2),
        );
        logger.info(`${entries.length} saved to ${excerptFile.name}`);

        const untranslated = entries.filter((e) => !e.translation);
        const untranslatedCount = untranslated.length;

        logger.info(
            `${untranslatedCount} entries (${(untranslatedCount / entries.length) * 100}%) still are not translated.`,
        );

        if ((untranslatedCount && untranslatedCount < 70) || parsedValues.show) {
            logger.info(`The following are still not translated: ${untranslated.map((e) => e.id).toString()}`);
        }

        const confirmed = await confirm({
            message: `Do you want to clear out the temporary translation files?`,
        });

        if (confirmed) {
            const blankWrites = TRANSLATION_IDS.map(
                async (id) => await Bun.file(path.format({ dir, ext: '.txt', name: id.toString() })).write(''),
            );
            await Promise.all(blankWrites);
        }
    }
};
