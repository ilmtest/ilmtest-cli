import { magentaBright, yellow } from 'ansis';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { addOrUpdateEntry, Entry, getEntries } from '../../api/entries.js';
import { getPages, Page } from '../../api/maktabah.js';
import { OUTPUT_DIR } from '../../utils/constants.js';
import { getNumericInput } from '../../utils/io.js';
import logger from '../../utils/logger.js';
import { loadOrDownload } from '../../utils/network.js';
import {
    indexArabicPages,
    indexEntriesByPage,
    mapIndexToMatn,
    mapLinesToEntries,
    PATTERNS,
    sanitizePageBody,
    sanitizeTranslation,
} from './utils.js';

const getTranslatedData = async (dir: string) => {
    const translationFile = Bun.file(path.format({ dir, ext: '.txt', name: 'translation' }));

    if (!(await translationFile.exists())) {
        await Bun.file(path.format({ dir, ext: '.txt', name: 'translation' })).write('');
    }

    const lines = sanitizeTranslation(await translationFile.text());

    return lines;
};

const saveEntries = async (entriesToUpdate: Partial<Entry>[], newEntries: Entry[], isPreview: boolean) => {
    for (const entry of entriesToUpdate) {
        logger.info(`Update entry: ${entry.id}`);

        if (!isPreview) {
            await addOrUpdateEntry(entry);
        }
    }

    for (const entry of newEntries.toSorted((a, b) => a.from - b.from)) {
        if (entry.index) {
            logger.info(`Add new entry at page: ${magentaBright(entry.from)} with index ${yellow(entry.index)}`);
        } else {
            logger.info(`Add new chapter at page: ${magentaBright(entry.from)} with title ${entry.translation}`);
        }

        if (!isPreview) {
            await addOrUpdateEntry(entry);
        }
    }
};

type TranslateOptions = {
    collection?: string;
    isPreview?: boolean;
    translator?: string;
};

export const translateWithAI = async ({ collection, isPreview = false, translator }: TranslateOptions = {}) => {
    const collectionId =
        collection ||
        (await getNumericInput('Enter collection ID to translate:', 'Please enter a valid collection ID'));

    const translatorId =
        translator || (await getNumericInput('Enter translator ID:', 'Please enter a valid translator ID'));

    const dir = path.join(OUTPUT_DIR, collectionId);
    await fs.mkdir(dir, { recursive: true });

    const pages = (await loadOrDownload<Page>('pages', getPages, collectionId, dir)).map(sanitizePageBody);
    const lines = await getTranslatedData(dir);

    const { indexToArabic, pageToBab } = indexArabicPages(pages, PATTERNS.NumberedSahihJami, true);
    const indexToMatn = mapIndexToMatn(pages.filter((p) => p.page).map((p) => p.body));
    //const indexToHadith = mapIndexToMatn(lines);

    Object.entries(indexToHadith)
        //.filter(([index]) => index === '53')
        .forEach(([index, translation]) => {
            const arabic = indexToMatn[index];
            const page = indexToArabic[index];

            console.log('index', index, 'page', page.page);
            console.log('arabic', arabic);
            console.log('translation', translation);

            console.log();
        });

    try {
        const { entriesToUpdate, newEntries } = mapLinesToEntries(
            lines,
            indexToArabic,
            pageToBab,
            indexEntriesByPage(await loadOrDownload<Entry>('entries', getEntries, collectionId, dir)),
            Number(collectionId),
            Number(translatorId),
        );

        //await saveEntries(entriesToUpdate, newEntries, isPreview);
    } catch (err: any) {
        logger.error(`index: ${err.index}, content: ${err.content}, ${err.stack}`);
    }
};
