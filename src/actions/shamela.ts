import { promises as fs } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import {
    type BookData,
    type GetBookMetadataResponsePayload,
    getBook,
    getBookMetadata,
    type Page,
    setLogger,
} from 'shamela';
import { getCollection } from '@/api/collections.js';
import { type Entry, getEntries } from '@/api/entries.js';
import type { Collection } from '@/types.js';

import { OUTPUT_DIR } from '@/utils/constants.js';
import logger from '@/utils/logger.js';
import { mapBookPagesToEntries } from '@/utils/mapping.js';
import { loadOrDownload } from '@/utils/network.js';
import { generatePrompt } from '@/utils/promptUtils.js';
import { sanitizePageContent } from '@/utils/shamelaUtils.js';

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
            span: {
                type: 'string',
            },
            unused: {
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
        entriesToFilter: values.entries?.split(','),
        from,
        max: Number(values.max) || Number.MAX_SAFE_INTEGER,
        span: Number(values.span) || Number.MAX_SAFE_INTEGER,
        to,
        unused: values.unused,
    };
};

type ShamelaPage = Page & {
    footer?: string;
};

export type ShamelaBook = Pick<BookData, 'titles'> &
    Partial<GetBookMetadataResponsePayload> & {
        shamelaId: number;
        pages: ShamelaPage[];
    };

const loadBook = async (bookId: number, [from, to]: number[], dir: string) => {
    const book = await loadOrDownload<ShamelaBook>(
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
        const [content, footer] = sanitizePageContent(p.content);
        return { ...p, content, ...(footer && { footer }) };
    });

    return book;
};

export const loadData = async () => {
    const { collectionId, from, to, entriesToFilter, ...rest } = parseInputArgs();

    const dir = path.join(OUTPUT_DIR, collectionId);
    await fs.mkdir(dir, { recursive: true });

    const collection = await loadOrDownload<Collection>('collection', async () => getCollection(collectionId), dir);
    const [bookId] = collection.fid!.map((fid) => fid.id).map(Number);

    setLogger(logger);
    const book = await loadBook(bookId, [from, to], dir);

    const entries = await loadOrDownload<Entry[]>(
        'entries',
        async () => getEntries(collectionId, { full: 1, limit: -1 }),
        dir,
    );

    const indexed = indexEntriesByNumber(entries);

    return {
        book,
        collection,
        coveredIndices: new Set(Object.keys(indexed.indexToEntries)),
        coveredPages: new Set(Object.keys(indexed.pageToEntries).map(Number)),
        dir,
        entries: entriesToFilter ? entries.filter((e) => entriesToFilter.includes(e.id)) : entries,
        ...rest,
    };
};

export const processShamela = async () => {
    const { book, collection, dir, max, unused, span, coveredIndices, coveredPages } = await loadData();

    if (unused === 'pages') {
        book.pages = book.pages.filter((p) => !coveredPages.has(p.id));
    }

    let arabicOnlyEntries: Partial<Entry>[] = mapBookPagesToEntries(book.pages, {
        maxPagesPerEntry: max,
    }).filter((e) => {
        return !e.to || e.to! - e.from! <= span;
    });

    if (unused === 'index') {
        arabicOnlyEntries = arabicOnlyEntries.filter((e) => !coveredIndices.has(getEntryKey(e)));
    }

    await generatePrompt(dir, collection.title, arabicOnlyEntries);

    await Bun.file(path.join(dir, 'excerpts.json')).write(JSON.stringify(arabicOnlyEntries, null, 2));
};
