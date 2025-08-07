import { magentaBright, yellow } from 'ansis';
import { removeSingleDigitReferences } from 'bitaboom';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { addOrUpdateEntry, Entry, getEntries } from '../../api/entries.js';
import { getPages, Page } from '../../api/maktabah.js';
import { OUTPUT_DIR } from '../../utils/constants.js';
import logger from '../../utils/logger.js';
import { loadOrDownload } from '../../utils/network.js';
import { indexDiscretePagesToEntries } from './discrete.js';
import { promptTranslateInputs } from './prompt.js';
import { removeFootnotesFromPages } from './transform.js';
import {
    correctMissingIndices,
    correctNumbering,
    indexEntriesByNumber,
    mapEntriesToUpdates,
    sanitizePageBody,
} from './utils.js';
import { validateGaplessEntryIndices } from './validation.js';
import { walkAndMapPagesToEntries } from './walker.js';

const getTranslatedData = async (dir: string, diff = 0) => {
    const translationFile = Bun.file(path.format({ dir, ext: '.txt', name: 'translation' }));

    if (!(await translationFile.exists())) {
        await translationFile.write('');
    }

    let contents = await translationFile.text();

    if (diff) {
        contents = contents.replace(/^(\d+)/gm, (match, num) => (parseInt(num) + diff).toString());
        await translationFile.write(contents);
    }

    return contents;
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

export const translateWithAI = async () => {
    const {
        autoFix,
        collectionId,
        diff,
        discrete,
        explains,
        fromPage,
        isPreview,
        refresh,
        removeFootnotes,
        toPage,
        translatorId,
        walk,
    } = await promptTranslateInputs();

    const dir = path.join(OUTPUT_DIR, collectionId);
    await fs.mkdir(dir, { recursive: true });

    let pages = (await loadOrDownload<Page>('pages', getPages, collectionId, dir)).map(sanitizePageBody);
    pages = pages.filter((p) => p.page >= fromPage && p.page <= toPage);
    pages = pages.map((p) => ({
        ...p,
        body: removeSingleDigitReferences(p.body),
    }));

    if (removeFootnotes) {
        pages = removeFootnotesFromPages(pages);
    }

    let lines = (await getTranslatedData(dir, diff)).split('\n').filter((entry) => entry.trim());

    if (autoFix) {
        pages = correctMissingIndices(pages);
        lines = correctNumbering(lines);
    }

    let entries: Entry[] = [];

    if (walk) {
        entries = walkAndMapPagesToEntries(pages, lines, translatorId);
    } else if (discrete) {
        entries = indexDiscretePagesToEntries(pages, lines, translatorId);
    }

    entries.forEach((e) => {
        if (e.arabic?.endsWith('*')) {
            e.arabic = e.arabic.slice(0, -1);
        }
    });

    validateGaplessEntryIndices(entries);

    const indexToEntry = indexEntriesByNumber(
        await loadOrDownload<Entry>('entries', getEntries, collectionId, dir, refresh),
    );

    const result = mapEntriesToUpdates(entries, indexToEntry, explains);

    try {
        await saveEntries(result.entriesToUpdate, result.newEntries, isPreview);
    } catch (err: any) {
        logger.error(`index: ${err.index}, content: ${err.content}, ${err.stack}`);
    } finally {
        process.stdout.write('\x07');
    }
};
