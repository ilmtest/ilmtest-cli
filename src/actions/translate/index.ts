import { magentaBright, yellow } from 'ansis';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { OUTPUT_DIR } from '@/utils/constants.js';

import { addOrUpdateEntry, Entry, getEntries } from '../../api/entries.js';
import { getPages, Page } from '../../api/maktabah.js';
import { getNumericInput } from '../../utils/io.js';
import logger from '../../utils/logger.js';
import { loadOrDownload } from '../../utils/network.js';
import {
    indexArabicPages,
    indexEntriesByPage,
    mapLinesToEntries,
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

export const translateWithAI = async (targetCollection?: string, translator?: string, isPreview = false) => {
    const collectionId = await getNumericInput(
        'Enter collection ID to translate:',
        'Please enter a valid collection ID',
        targetCollection,
    );

    const translatorId = await getNumericInput(
        'Enter translator ID:',
        'Please enter a valid translator ID',
        translator,
    );

    const dir = path.join(OUTPUT_DIR, collectionId);
    await fs.mkdir(dir, { recursive: true });

    const pages = (await loadOrDownload<Page>('pages', getPages, collectionId, dir)).map(sanitizePageBody);
    const lines = await getTranslatedData(dir);

    const { indexToArabic, pageToBab } = indexArabicPages(pages);
    //console.log('indexToArabic', indexToArabic);

    try {
        const { entriesToUpdate, newEntries } = mapLinesToEntries(
            lines,
            indexToArabic,
            pageToBab,
            indexEntriesByPage(await loadOrDownload<Entry>('entries', getEntries, collectionId, dir)),
            Number(collectionId),
            Number(translatorId),
        );

        await saveEntries(entriesToUpdate, newEntries, isPreview);
    } catch (err: any) {
        logger.error(`index: ${err.index}, content: ${err.content}, ${err.stack}`);
    }
};
