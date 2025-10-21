import { promises as fs } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { type BookData, getBook, getBookMetadata, setLogger } from 'shamela';
import { getCollection } from '@/api/collections.js';
import { type Entry, getEntries } from '@/api/entries.js';
import type { Collection, Excerpts, ShamelaBook } from '@/types.js';

import { OUTPUT_DIR } from '@/utils/constants.js';
import { getEntryKey, indexEntriesForLookup } from '@/utils/entryUtils.js';
import logger from '@/utils/logger.js';
import { mapBookPagesToEntries } from '@/utils/mapping.js';
import { loadOrDownload } from '@/utils/network.js';
import { generatePrompt } from '@/utils/promptUtils.js';
import { getPageBodyAndFootnotes } from '@/utils/textUtils.js';

/**
 * Parses command line arguments for Shamela operations
 * @returns Parsed configuration object with collection ID, page range, and options
 * @throws Error if no collection is specified
 */
const parseInputArgs = () => {
    const { values } = parseArgs({
        options: {
            entries: {
                type: 'string',
            },
            migrate: {
                type: 'string',
            },
            pages: {
                type: 'string',
            },
            shamela: {
                type: 'string',
            },
            unused: {
                type: 'string',
            },
        },
        strict: true,
    });

    const [from = 1, to = Number.MAX_SAFE_INTEGER] = (values.pages?.split('-') || []).map(Number);

    return {
        collectionId: String(values.shamela || values.migrate),
        entriesToFilter: values.entries?.split(','),
        from,
        to,
        unused: values.unused,
    };
};

/**
 * Loads a Shamela book with specified page range and processes content
 * @param bookId - The Shamela book identifier
 * @param param1 - Tuple containing from and to page numbers
 * @param dir - Directory to cache the book data
 * @returns Promise resolving to processed ShamelaBook object
 */
const loadBook = async (bookId: number, [from, to]: number[], dir: string) => {
    const book = await loadOrDownload<BookData>(
        'book',
        async () => {
            const [metadata, shamelaBook] = await Promise.all([getBookMetadata(bookId), getBook(bookId)]);

            return {
                majorRelease: metadata.majorRelease,
                minorRelease: metadata.minorRelease,
                shamelaId: bookId,
                ...shamelaBook,
            };
        },
        dir,
    );

    if ((book as any).contractVersion) {
        const { pages } = book as any;
        return {
            pages: pages.map((p: any) => ({
                content: p.text.replace(/\n/g, '\r').replace(/\([\u0660-\u0669]+\)/g, ''),
                footer: p.footnotes,
                id: p.page,
                pp: p.volumePage,
                volume: p.volume,
            })),
        } as ShamelaBook;
    }

    if ((book as any).ocrEngine) {
        const { pages } = book as any;
        return {
            pages: pages.map((p: any) => ({
                content: p.body.replace(/\n/g, '\r').replace(/\([\u0660-\u0669]+\)/g, ''),
                id: p.page,
                pp: p.pp,
                volume: p.part,
            })),
        } as ShamelaBook;
    }

    book.pages = book.pages.filter((p) => p.id >= from && p.id <= to);
    book.pages = book.pages.map(({ part, page, ...p }) => {
        const [content, footer] = getPageBodyAndFootnotes(p.content);
        return { ...p, content, ...(footer && { footer }), pp: page || 0, volume: Number(part) || 1 };
    });

    return book as ShamelaBook;
};

/**
 * Loads and prepares all necessary data for Shamela processing
 * Includes collection data, book content, and entry information
 * @returns Promise resolving to comprehensive data object for processing
 */
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

    const indexed = indexEntriesForLookup(entries);

    const optionsFile = Bun.file(path.join(dir, 'options.json'));

    return {
        book,
        collection,
        coveredIndices: new Set(Object.keys(indexed.indexToEntries)),
        coveredPages: new Set(Object.keys(indexed.pageToEntries).map(Number)),
        dir,
        entries: entriesToFilter ? entries.filter((e) => entriesToFilter.includes(e.id)) : entries,
        options: (await optionsFile.exists()) ? await optionsFile.json() : {},
        ...rest,
    };
};

/**
 * Main function to process Shamela content and generate translation prompts
 * Processes book pages, filters content based on options, and generates output files
 * @returns Promise that resolves when processing is complete
 */
export const processShamela = async () => {
    const { book, collection, dir, unused, coveredIndices, coveredPages, options } = await loadData();

    let arabicOnlyEntries: Partial<Entry>[] = mapBookPagesToEntries(book.pages, options);

    if (unused === 'pages') {
        arabicOnlyEntries = arabicOnlyEntries
            .filter((e) => !coveredPages.has(e.from!))
            .filter((e) => !e.to || !coveredPages.has(e.to));
    }

    if (unused === 'index') {
        arabicOnlyEntries = arabicOnlyEntries.filter((e) => !coveredIndices.has(getEntryKey(e)));
    }

    if (unused) {
        // if we removed a page in between a sequence, get rid of the entries which happens to span from one page to a distant one
        arabicOnlyEntries = arabicOnlyEntries.filter((e) => !e.to || e.to - e.from! <= 1);
    }

    const excerptsFile = Bun.file(path.join(dir, 'excerpts.json'));
    const fileExists = await excerptsFile.exists();

    await generatePrompt(dir, collection.title, arabicOnlyEntries);

    if (!fileExists) {
        await excerptsFile.write(
            JSON.stringify(
                {
                    contractVersion: 'v1.1',
                    createdAt: Date.now(),
                    excerpts: arabicOnlyEntries as Entry[],
                    lastUpdatedAt: Date.now(),
                    options,
                } satisfies Excerpts,
                null,
                2,
            ),
        );
    }
};
