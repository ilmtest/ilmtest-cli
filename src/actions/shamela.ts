import { promises as fs } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { type BookData, getBook, getBookMetadata, GetBookMetadataResponsePayload, setLogger } from 'shamela';

import type { Collection } from '@/types.js';

import { getCollection } from '@/api/collections.js';
import { Entry, getEntries } from '@/api/entries.js';
import { patchArray } from '@/utils/common.js';
import { FLAGS_PENDING_REVIEW, OUTPUT_DIR } from '@/utils/constants.js';
import logger from '@/utils/logger.js';
import { applyTranslationsToEntries, mapBookPagesToEntries } from '@/utils/mapping.js';
import { loadOrDownload } from '@/utils/network.js';
import { generatePrompt } from '@/utils/promptUtils.js';
import { sanitizePageContent } from '@/utils/shamelaUtils.js';
import { loadTranslations, removeDuplicateTranslations } from '@/utils/translationFileParser.js';

import { getEntryKey, indexEntriesByNumber } from '../utils/entryUtils.js';

const parseInputArgs = () => {
    const { values } = parseArgs({
        options: {
            collection: {
                type: 'string',
            },
            entries: {
                type: 'string',
            },
            log: {
                type: 'string',
            },
            max: {
                type: 'string',
            },
            pages: {
                type: 'string',
            },
            shamela: {
                type: 'boolean',
            },
            unused: {
                type: 'string',
            },
            url: {
                type: 'string',
            },
        },
        strict: true,
    });

    if (!values.collection) {
        throw new Error('No collection specified');
    }

    if (values.log) {
        logger.level = values.log;
    }

    const [from = 1, to = Number.MAX_SAFE_INTEGER] = (values.pages?.split('-') || []).map(Number);

    return {
        collectionId: values.collection,
        entriesToFilter: values.entries?.split(',').map(Number),
        from,
        max: Number(values.max || Number.MAX_SAFE_INTEGER),
        to,
        unused: values.unused,
        url: values.url,
    };
};

const loadBook = async (bookId: number, [from, to]: number[], dir: string) => {
    const book = await loadOrDownload<BookData & Partial<GetBookMetadataResponsePayload> & { shamelaId: number }>(
        'book',
        async () => {
            const [metadata, bookData] = await Promise.all([getBookMetadata(bookId), getBook(bookId)]);
            return {
                majorRelease: metadata.majorRelease,
                minorRelease: metadata.minorRelease,
                shamelaId: bookId,
                ...bookData,
            };
        },
        dir,
    );

    book.pages = book.pages.filter((p) => p.id >= from && p.id <= to);
    book.pages = book.pages.map((p) => {
        return { ...p, content: sanitizePageContent(p.content) };
    });

    return book;
};

type LoadDataOptions = {
    loadFullEntries?: boolean;
};

export const loadData = async (options: LoadDataOptions = {}) => {
    const { collectionId, from, to, ...rest } = parseInputArgs();

    const dir = path.join(OUTPUT_DIR, collectionId);
    await fs.mkdir(dir, { recursive: true });

    const collection = await loadOrDownload<Collection>('collection', async () => getCollection(collectionId), dir);
    const [bookId] = collection.fid!.map((fid) => fid.id).map(Number);

    setLogger(logger);
    const book = await loadBook(bookId, [from, to], dir);

    const entries = await loadOrDownload<Entry[]>(
        'entries',
        async () => getEntries(collectionId, { limit: -1, ...(options.loadFullEntries && { full: 1 }) }),
        dir,
    );

    return { book, collection, dir, ...indexEntriesByNumber(entries), entries, ...rest };
};

const filterCoveredPagesFromBook = (book: BookData, coveredPages: number[]) => {
    const covered = new Set(coveredPages);
    const uncoveredPages = book.pages.filter((p) => !covered.has(p.id));

    return uncoveredPages;
};

export const processShamela = async () => {
    const { book, collection, dir, entriesToFilter, indexToEntries, max, pageToEntries, unused, url } = await loadData({
        loadFullEntries: true,
    });

    if (unused === 'pages') {
        book.pages = filterCoveredPagesFromBook(book, Object.keys(pageToEntries).map(Number));
    }

    console.log('book.pages', book.pages);

    let arabicOnlyEntries: Partial<Entry>[] = mapBookPagesToEntries(book, {
        //markerPattern: /^\[\] (.*)/,
        max,
    }).filter((e) => {
        return !e.to || e.to! - e.from! <= max;
    });
    console.log('arabicOnlyEntries', arabicOnlyEntries);

    if (unused === 'index') {
        const indexKeys = new Set(Object.keys(indexToEntries));

        arabicOnlyEntries = arabicOnlyEntries.filter((e) => {
            return !indexKeys.has(getEntryKey(e));
        });
    }

    await generatePrompt(dir, collection.title, arabicOnlyEntries);

    let translations = await loadTranslations(dir);
    translations = removeDuplicateTranslations(translations);

    if (entriesToFilter) {
        translations = translations.filter((t) => t.index && entriesToFilter.includes(t.index));
    }

    let finalEntries = applyTranslationsToEntries(arabicOnlyEntries as Entry[], translations);
    finalEntries = patchArray(finalEntries, (e) => {
        return {
            collection: Number(collection.id),
            flags: FLAGS_PENDING_REVIEW,
            volume: e.volume || 1,
            ...(url && { url }),
        };
    });

    console.log(finalEntries);
};
