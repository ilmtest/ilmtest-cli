import { magentaBright, yellow } from 'ansis';
import { removeSingleDigitReferences } from 'bitaboom';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { getCollection } from '@/api/collections.js';

import { addOrUpdateEntry, Entry, getEntries } from '../../api/entries.js';
import { Bookmark, getBookmarks, getPages, Page } from '../../api/maktabah.js';
import { OUTPUT_DIR, TRANSLATE_PROMPT } from '../../utils/constants.js';
import logger from '../../utils/logger.js';
import { loadOrDownload } from '../../utils/network.js';
import { injectIndexByPage, injectIndexByPrefix } from './injector.js';
import { FLAGS_PENDING_REVIEW, TYPE_CHAPTER } from './mapping.js';
import { promptTranslateInputs } from './prompt.js';
import {
    applyTranslationsToEntries,
    sprintAndMapPages,
    sprintAndMapPagesByLines,
    sprintAndMapPagesByParagraphs,
} from './sprinter.js';
import { removeFootnotesFromPages } from './transform.js';
import { indexEntriesByNumber, mapEntriesToUpdates, sanitizePageBody } from './utils.js';
import { fixGaps } from './validation.js';

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

const writePromptFile = async (dir: string, collectionId: string, entries: Entry[]) => {
    const promptFile = Bun.file(path.format({ dir, ext: '.txt', name: 'prompt' }));

    if (!(await promptFile.exists())) {
        logger.info(`Writing ${promptFile.name}...`);
        const collection = await getCollection(collectionId);

        await promptFile.write(
            [
                TRANSLATE_PROMPT.join('\n').replace('{{book}}', collection.title),
                '\n',
                entries.map((e) => `${e.index} - ${e.arabic}`).join('\n'),
            ].join('\n'),
        );
    }
};

const loadPages = async () => {
    const { collectionId, fromPage, removeFootnotes, toPage, ...rest } = await promptTranslateInputs();

    const dir = path.join(OUTPUT_DIR, collectionId);
    await fs.mkdir(dir, { recursive: true });

    let pages = (
        await loadOrDownload<Page[]>(
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

    if (removeFootnotes) {
        pages = removeFootnotesFromPages(pages);
    }

    //pages = injectIndexByPrefix(pages, 'حدثن');
    //pages = injectIndexByPage(pages);

    const bookmarks = await loadOrDownload<Bookmark>(
        'bookmarks',
        async () => {
            return getBookmarks(collectionId);
        },
        dir,
    );

    return { bookmarks, collectionId, dir, pages, ...rest };
};

export const translateWithAI = async () => {
    const { bookmarks, collectionId, diff, dir, explains, isPreview, pages, refresh, strategy, translatorId, url } =
        await loadPages();

    const { indexToEntry, pageToEntries } = indexEntriesByNumber(
        await loadOrDownload<Entry[]>(
            'entries',
            async () => {
                return getEntries(collectionId, { limit: -1 });
            },
            dir,
            refresh,
        ),
    );

    const bookmarked = new Set(bookmarks.map((b) => b.page));

    let entries: Entry[] = [];

    if (strategy === 'walk') {
        //entries = sprintAndMapPages(pages);
        entries = sprintAndMapPagesByParagraphs(pages);
        //entries = sprintAndMapPagesByLines(pages);
    }

    entries = fixGaps(entries);
    //validateGaplessEntryIndices(entries);

    //entries = entries.filter((e) => indexToEntry[getEntryKey(e)]?.from !== e.from);
    entries = entries.filter((e) => !pageToEntries[e.from]);

    await writePromptFile(dir, collectionId, entries);

    const lines = (await getTranslatedData(dir, diff)).split('\n').filter((entry) => entry.trim());

    entries = applyTranslationsToEntries(entries, lines);

    const result = mapEntriesToUpdates(entries, indexToEntry, pageToEntries, {
        explains,
        flags: FLAGS_PENDING_REVIEW,
        translatorId,
        //shouldMatchIndexWithAnyPage: true,
        //shouldUpdateArabic: true,
        url,
    });

    result.newEntries = result.newEntries.map(({ index, ...e }) => ({
        ...e,
        index,
        ...(bookmarked.has(e.from) && { type: TYPE_CHAPTER }),
    }));

    try {
        await saveEntries(result.entriesToUpdate, result.newEntries, isPreview);
    } catch (err: any) {
        logger.error(`index: ${err.index}, content: ${err.content}, ${err.stack}`);
    } finally {
        process.stdout.write('\x07');
    }
};
