import { magentaBright, yellow } from 'ansis';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { addOrUpdateEntry, Entry, getEntries } from '../../api/entries.js';
import { getPages, Page } from '../../api/maktabah.js';
import { OUTPUT_DIR } from '../../utils/constants.js';
import { getNumericInput } from '../../utils/io.js';
import logger from '../../utils/logger.js';
import { loadOrDownload } from '../../utils/network.js';
import { indexTranslationLines, removeFootnotesFromPages } from './transform.js';
import {
    correctMissingIndices,
    correctNumbering,
    indexArabicPages,
    indexEntriesByNumber,
    indexEntriesByPage,
    mapEntriesToUpdates,
    mapIndexToPage,
    mapIndexToText,
    mapLinesToEntries,
    PATTERNS,
    sanitizePageBody,
    sanitizeTranslation,
} from './utils.js';
import { validateGaplessEntryIndices } from './validation.js';

const getTranslatedData = async (dir: string, diff = 0) => {
    const translationFile = Bun.file(path.format({ dir, ext: '.txt', name: 'translation' }));

    if (!(await translationFile.exists())) {
        await translationFile.write('');
    }

    const contents = await translationFile.text();

    if (diff) {
        const contents2 = contents.replace(/^(\d+)/gm, (match, num) => (parseInt(num) + diff).toString());
        await translationFile.write(contents2);
    }

    const lines = sanitizeTranslation(contents);

    return lines;
};

const saveEntries = async (entriesToUpdate: Partial<Entry>[], newEntries: Entry[], isPreview: boolean) => {
    for (const entry of entriesToUpdate) {
        logger.info(`Update entry: ${entry.id}`);

        if (isPreview) {
            logger.info(`Text: ${entry.translation}`);
        } else {
            await addOrUpdateEntry(entry);
        }
    }

    for (const entry of newEntries.toSorted((a, b) => a.from - b.from)) {
        if (entry.index) {
            logger.info(`Add new entry at page: ${magentaBright(entry.from)} with index ${yellow(entry.index)}`);
        } else {
            logger.info(`Add new chapter at page: ${magentaBright(entry.from)}`);
        }

        if (isPreview) {
            logger.info(`Text: ${entry.translation}\n${entry.arabic}\n\n`);
        } else {
            await addOrUpdateEntry(entry);
        }
    }
};

type TranslateOptions = {
    collection?: string;
    fromPage?: number;
    isPreview?: boolean;
    toPage?: number;
    translator?: string;
};

const processSahihJamiStyle = async (
    pages: Page[],
    lines: string[],
    { collection, dir, fromPage, isPreview, toPage, translator }: Required<TranslateOptions> & { dir: string },
) => {
    const indexToPage = mapIndexToPage(
        pages.filter((p) => p.page >= fromPage && p.page <= toPage),
        false,
        /^\(\d+\) /,
    );

    const indexToHadith = mapIndexToText(lines, /^\(\d+\) /);
    //console.log('indexToHadith', indexToHadith);
    const indexToEntry = indexEntriesByNumber(await loadOrDownload<Entry>('entries', getEntries, collection, dir));

    const entries = Object.entries(indexToHadith).map(([index, translation]) => {
        const page = indexToPage[index];

        if (!page) {
            console.error(indexToPage);
            console.error('page not found for index', index);
            throw new Error();
        }

        return {
            arabic: page.body.replace(PATTERNS.NumericPrefix, '').replace(PATTERNS.HyphenPrefix, ''),
            collection: Number(collection),
            flags: 3,
            from: page.page,
            ...(page.end && page.end !== page.page && { to: page.end }),
            index: Number(index),
            pp: page.pp,
            translation: translation.replace(PATTERNS.NumericPrefix, '').replace(PATTERNS.HyphenPrefix, ''),
            translator: Number(translator),
            volume: page.volume,
        } as Entry;
    });

    validateGaplessEntryIndices(entries);

    const result = mapEntriesToUpdates(entries, indexToEntry);
    await saveEntries(result.entriesToUpdate, result.newEntries, isPreview);
};

export const translateWithAI = async ({
    collection,
    fromPage = 1,
    isPreview = false,
    toPage = Number.MAX_SAFE_INTEGER,
    translationIndexDiff,
    translator,
}: TranslateOptions & { translationIndexDiff?: number } = {}) => {
    const collectionId =
        collection ||
        (await getNumericInput('Enter collection ID to translate:', 'Please enter a valid collection ID'));

    const translatorId =
        translator || (await getNumericInput('Enter translator ID:', 'Please enter a valid translator ID'));

    const dir = path.join(OUTPUT_DIR, collectionId);
    await fs.mkdir(dir, { recursive: true });

    const pages = (await loadOrDownload<Page>('pages', getPages, collectionId, dir)).map(sanitizePageBody);

    //pages = removeFootnotesFromPages(pages);
    const lines = await getTranslatedData(dir, translationIndexDiff);

    if (1 === Number(1)) {
        return processSahihJamiStyle(pages, lines, {
            collection: collectionId,
            dir,
            fromPage,
            isPreview,
            toPage,
            translator: translatorId,
        });
    }
    //pages = correctMissingIndices(pages);
    //lines = correctNumbering(lines);
    const { indexToArabic, pageToBab } = indexArabicPages(pages);
    /*const indexToArabic = mapIndexToPage(
        pages.filter((p) => p.page >= fromPage && p.page <= toPage),
        true,
        /^(\d+)\s?[-–] (.*)/s,
    ); */

    const translatedListItems = indexTranslationLines(lines);

    try {
        const { entriesToUpdate, newEntries } = mapLinesToEntries(
            translatedListItems,
            indexToArabic,
            pageToBab,
            //{},
            indexEntriesByPage(await loadOrDownload<Entry>('entries', getEntries, collectionId, dir, true)),
            Number(collectionId),
            Number(translatorId),
            //true,
        );

        await saveEntries(entriesToUpdate, newEntries, isPreview);
    } catch (err: any) {
        logger.error(`index: ${err.index}, content: ${err.content}, ${err.stack}`);
    }
};
