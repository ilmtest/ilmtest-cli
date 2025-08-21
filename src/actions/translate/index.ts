import { magentaBright, yellow } from 'ansis';
import { removeSingleDigitReferences } from 'bitaboom';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { getCollection } from '@/api/collections.js';

import { addOrUpdateEntry, Entry, getEntries } from '../../api/entries.js';
import { Bookmark, getBookmarks, getPages, Page } from '../../api/maktabah.js';
import { OUTPUT_DIR } from '../../utils/constants.js';
import logger from '../../utils/logger.js';
import { loadOrDownload } from '../../utils/network.js';
import { indexDiscretePagesToEntries } from './discrete.js';
import { promptUserForPairs } from './interactive.js';
import { promptTranslateInputs } from './prompt.js';
//import { walkAndMapPagesToEntries } from './riyad.js';
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
        logger.info(`Update entry: ${entry.id} ${entry.url || ''}`);

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

const writePromptFile = async (dir: string, collectionId: string, pages: Page[], coveredPageNumbers: number[]) => {
    const promptFile = Bun.file(path.format({ dir, ext: '.txt', name: 'prompt' }));
    const usedPageNumbers = new Set(coveredPageNumbers);

    if (!(await promptFile.exists())) {
        logger.info(`Writing ${promptFile.name}...`);
        const collection = await getCollection(collectionId);

        await promptFile.write(
            [
                `You are a professional Arabic to English translator who specializes in Islāmic content.`,
                `You will be translating from the book: ${collection.title}.`,
                'Translate the following Arabic text into English with the highest level of accuracy preferring literal translations except when the context fits to translate by meaning.',
                'Carefully analyze the context to ensure the correct usage of Islamic technical terminology.',
                'Preserve full chains of narration and use ALA-LC transliteration only on the names of the narrators in the chain but not the textual content nor words like "Ḥaddathanā". Translate chapter headings as well.',
                'Translate "God" as Allah unless the Arabic is actually refering to an ilāh.',
                'Respond only in plain-text, no markdown or formatting. Keep each narration in a single line without any line breaks within it.',
                'Revise your translation 3 times before sending it to verify its accuracy.',
                '\n',
                ...pages.filter((p) => !usedPageNumbers.has(p.page)).map((p) => p.body),
            ].join('\n'),
        );
    }
};

export const translateWithAI = async () => {
    const {
        autoFix,
        collectionId,
        diff,
        explains,
        fromPage,
        isPreview,
        refresh,
        removeFootnotes,
        strategy,
        toPage,
        translatorId,
        url,
    } = await promptTranslateInputs();

    const dir = path.join(OUTPUT_DIR, collectionId);
    await fs.mkdir(dir, { recursive: true });

    let pages = (
        await loadOrDownload<Page>(
            'pages',
            async () => {
                const result = await getPages(collectionId);
                return result;
            },
            dir,
        )
    ).map(sanitizePageBody);
    pages = pages.filter((p) => p.page >= fromPage && p.page <= toPage);
    pages = pages.map((p) => ({
        ...p,
        body: removeSingleDigitReferences(p.body),
    }));

    const bookmarks = await loadOrDownload<Bookmark>(
        'bookmarks',
        async () => {
            const result = await getBookmarks(collectionId);
            return result;
        },
        dir,
    );

    if (removeFootnotes) {
        pages = removeFootnotesFromPages(pages);
    }

    let lines = (await getTranslatedData(dir, diff)).split('\n').filter((entry) => entry.trim());

    if (autoFix) {
        pages = correctMissingIndices(pages);
        lines = correctNumbering(lines);
    }

    const { indexToEntry, pageToEntries } = indexEntriesByNumber(
        await loadOrDownload<Entry>(
            'entries',
            async () => {
                const result = await getEntries(collectionId, { limit: -1 });
                return result;
            },
            dir,
            refresh,
        ),
    );

    await writePromptFile(dir, collectionId, pages, Object.keys(pageToEntries).map(Number));

    let entries: Entry[] = [];

    if (strategy === 'walk') {
        entries = walkAndMapPagesToEntries(pages, lines, translatorId, bookmarks);
        //entries = await walkAndMapPagesToEntries(pages, translatorId);
    } else if (strategy === 'discrete') {
        entries = indexDiscretePagesToEntries(pages, lines, translatorId);
    } else if (strategy === 'interactive') {
        entries = await promptUserForPairs(pages, translatorId, dir);
    }

    //validateGaplessEntryIndices(entries);

    const result = mapEntriesToUpdates(entries, indexToEntry, pageToEntries, {
        explains,
        shouldMatchIndexWithAnyPage: true,
        shouldUpdateArabic: true,
        url,
    });

    try {
        await saveEntries(result.entriesToUpdate, result.newEntries, isPreview);
    } catch (err: any) {
        logger.error(`index: ${err.index}, content: ${err.content}, ${err.stack}`);
    } finally {
        process.stdout.write('\x07');
    }
};
