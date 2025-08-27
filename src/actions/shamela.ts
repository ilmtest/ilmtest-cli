import { promises as fs } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { type BookData, getBook, setLogger } from 'shamela';

import type { Collection } from '@/types.js';

import { getCollection } from '@/api/collections.js';
import { Entry } from '@/api/entries.js';
import { OUTPUT_DIR, TRANSLATE_PROMPT } from '@/utils/constants.js';
import logger from '@/utils/logger.js';
import { loadOrDownload } from '@/utils/network.js';
import { parseContentRobust, removeFootnoteReferencesSimple } from '@/utils/shamelaUtils.js';
import { arabicNumeralToNumber } from '@/utils/textUtils.js';

import { TYPE_CHAPTER } from './translate/mapping.js';

const ARABIC_NUMERIC_LIST_ITEM = /^([\u0660-\u0669]+)\s?[-–—ـ](.*)/;

const parseInputArgs = () => {
    const { values } = parseArgs({
        options: {
            collection: {
                type: 'string',
            },
            log: {
                type: 'string',
            },
            pages: {
                type: 'string',
            },
            shamela: {
                type: 'boolean',
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

    return { collectionId: values.collection, from, to };
};

const sanitizePageContent = (text: string) => {
    let content = removeFootnoteReferencesSimple(text)
        .replace(/舄/g, '')
        .replace(/<img[^>]*>>/, '');
    const indexOfFootnote = content.lastIndexOf('_________');

    if (indexOfFootnote >= 0) {
        content = content.slice(0, indexOfFootnote);
    }

    return content;
};

const loadData = async () => {
    const { collectionId, from, to } = parseInputArgs();

    const dir = path.join(OUTPUT_DIR, collectionId);
    await fs.mkdir(dir, { recursive: true });

    const collection = await loadOrDownload<Collection>('collection', async () => getCollection(collectionId), dir);
    const [bookId] = collection.fid!.map((fid) => fid.id).map(Number);

    setLogger(logger);
    const book = await loadOrDownload<BookData>('book', async () => getBook(bookId), dir);

    book.pages = book.pages.filter((p) => p.id >= from && p.id <= to);
    book.pages = book.pages.map((p) => {
        return { ...p, content: sanitizePageContent(p.content) };
    });

    return { book, collection, dir };
};

const mapBookPagesToEntries = (book: BookData) => {
    const entries: Partial<Entry>[] = [];

    for (const page of book.pages) {
        logger.debug(`page ${page.id}.content: ${page.content}`);
        const lines = parseContentRobust(page.content);

        logger.debug(`lines: ${JSON.stringify(lines, null, 2)}`);

        const entry = {
            from: page.id,
            ...(page.page && { pp: page.page }),
            volume: page.part!,
        };

        for (const line of lines) {
            if (line.id) {
                entries.push({
                    ...entry,
                    arabic: line.text.trim(),
                    index: Number(line.id),
                    type: TYPE_CHAPTER,
                });

                continue;
            }

            const [, index, text] = line.text.match(ARABIC_NUMERIC_LIST_ITEM) || [];

            if (index && text) {
                const romanNumber = arabicNumeralToNumber(index);

                entries.push({
                    ...entry,
                    arabic: text.trim(),
                    index: romanNumber,
                });

                continue;
            }

            if (entries.length > 0) {
                entries.at(-1)!.arabic += '\n' + line.text.trim();
            }
        }
    }

    return entries;
};

const mapEntriesToPrompt = (entries: Partial<Entry>[]) => {
    const lines = entries.map((e) => {
        if (e.type === TYPE_CHAPTER) {
            return `C${e.index} - ${e.arabic}`;
        }

        return `${e.index} - ${e.arabic}`;
    });

    return lines;
};

const generatePrompt = async (dir: string, title: string, entries: Partial<Entry>[]) => {
    const promptFile = Bun.file(path.format({ dir, ext: '.txt', name: 'prompt' }));

    if (!(await promptFile.exists())) {
        logger.info(`Writing ${promptFile.name}...`);

        const stringifiedEntries = mapEntriesToPrompt(entries);

        await promptFile.write(
            [TRANSLATE_PROMPT.join('\n').replace('{{book}}', title), '\n\n', stringifiedEntries.join('\n\n')].join(
                '\n',
            ),
        );
    }
};

export const processShamela = async () => {
    const { book, collection, dir } = await loadData();

    const entries: Partial<Entry>[] = mapBookPagesToEntries(book);

    for (const entry of entries) {
        entry.collection = Number(collection.id);
    }

    console.log('entries', entries);
    await generatePrompt(dir, collection.title, entries);
};
