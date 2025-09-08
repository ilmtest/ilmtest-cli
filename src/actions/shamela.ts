import { magentaBright, yellow } from 'ansis';
import { isAllUppercase, toTitleCase } from 'bitaboom';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { type BookData, getBook, GetBookMetadataResponsePayload, setLogger } from 'shamela';

import type { Collection } from '@/types.js';

import { getCollection } from '@/api/collections.js';
import { addOrUpdateEntry, Entry, getEntries } from '@/api/entries.js';
import { OUTPUT_DIR, TRANSLATE_PROMPT } from '@/utils/constants.js';
import logger from '@/utils/logger.js';
import { loadOrDownload } from '@/utils/network.js';
import { parseContentRobust, removeFootnoteReferencesSimple } from '@/utils/shamelaUtils.js';
import { arabicNumeralToNumber } from '@/utils/textUtils.js';

import { FLAGS_PENDING_REVIEW, TYPE_CHAPTER } from './translate/mapping.js';
import { PATTERNS } from './translate/patterns.js';
import { getEntryKey, indexEntriesByNumber } from './translate/utils.js';

const ARABIC_NUMERIC_LIST_ITEM = /^([\u0660-\u0669]+)\s?[-–—ـ](.*)/;

const TYPE_MARKER = -1;

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

const loadBook = async (bookId: number, [from, to]: number[], dir: string) => {
    const book = await loadOrDownload<BookData & Partial<GetBookMetadataResponsePayload>>(
        'book',
        async () => getBook(bookId),
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

type MapBookPagesToEntriesOptions = {
    markerPattern?: RegExp;
    max: number;
};

export const mapBookPagesToEntries = (book: BookData, options: MapBookPagesToEntriesOptions) => {
    const entries: Partial<Entry>[] = [];

    for (const page of book.pages) {
        logger.trace(`page ${page.id}.content: ${page.content}`);
        const lines = parseContentRobust(page.content);

        logger.trace(`lines: ${JSON.stringify(lines, null, 2)}`);

        const entry = {
            from: page.id,
            ...(page.page && { pp: page.page }),
            volume: page.part!,
        };

        let nextMarkerId = 0;

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

            const [, index, text] =
                line.text.match(ARABIC_NUMERIC_LIST_ITEM) || line.text.match(PATTERNS.MatchNumericListItem) || [];

            if (index && text) {
                const romanNumber = arabicNumeralToNumber(index);

                entries.push({
                    ...entry,
                    arabic: text.trim(),
                    index: romanNumber,
                });

                continue;
            }

            const arabic = line.text.trim();

            if (options.markerPattern) {
                const [, matchedText] = arabic.match(options.markerPattern) || [];

                if (matchedText) {
                    entries.push({
                        ...entry,
                        arabic: matchedText,
                        index: parseInt(`${page.id}${++nextMarkerId}`),
                        type: TYPE_MARKER,
                    });
                    continue;
                }
            }

            if (!entries.length) {
                continue;
            }

            const lastEntry = entries.at(-1)!;
            const diff = page.id - lastEntry.from!;

            if (diff > options.max) {
                entries.push({
                    ...entry,
                    arabic,
                });

                continue;
            }

            lastEntry.arabic += '\n' + arabic;

            if (diff) {
                lastEntry.to = page.id;
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

        if (e.type === TYPE_MARKER) {
            return `M${e.index} - ${e.arabic}`;
        }

        if (!e.index) {
            return `P${e.from} - ${e.arabic}`;
        }

        return `${e.index} - ${e.arabic}`;
    });

    return lines;
};

const getTranslationFile = async (dir: string, names: string[]) => {
    for (const name of names) {
        const translationFile = Bun.file(path.format({ dir, ext: '.txt', name }));

        if (await translationFile.exists()) {
            return translationFile;
        }
    }
};

type Translation = Pick<Entry, 'index' | 'translation' | 'translator' | 'type'> & Pick<Partial<Entry>, 'from'>;

const loadTranslations = async (dir: string): Promise<Translation[]> => {
    const file = await getTranslationFile(dir, ['873', '879', '153']);

    if (!file) {
        logger.warn(`No translation files found.`);
        return [];
    }

    logger.info(`Using ${file.name}`);

    const translations: Translation[] = [];
    const lines = (await file.text())
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

    for (const line of lines) {
        let [, index, text] = line.match(/^C(\d+)\s?[-–—ـ](.*)/) || [];

        if (index && text) {
            translations.push({
                index: parseInt(index),
                translation: isAllUppercase(text) ? toTitleCase(text) : text,
                type: TYPE_CHAPTER,
            });
            continue;
        }

        [, index, text] = line.match(/^M(\d+)\s?[-–—ـ](.*)/) || [];

        if (index && text) {
            translations.push({
                index: parseInt(index),
                translation: text,
                type: TYPE_MARKER,
            });
            continue;
        }

        [, index, text] = line.match(/^P(\d+)\s?[-–—ـ](.*)/) || [];

        if (index && text) {
            translations.push({ from: parseInt(index), translation: text });
            continue;
        }

        [, index, text] = line.match(PATTERNS.MatchNumericListItem) || [];

        if (index && text) {
            translations.push({ index: parseInt(index), translation: text });
            continue;
        }

        translations.at(-1)!.translation += '\n' + line;
    }

    const [translator] = file.name!.split('/').at(-1)!.split('.').map(Number);
    return translations.map(({ translation, ...t }) => ({ ...t, translation: translation!.trim(), translator }));
};

const generatePrompt = async (dir: string, title: string, entries: Partial<Entry>[]) => {
    const promptFile = Bun.file(path.format({ dir, ext: '.txt', name: 'prompt' }));

    if (!(await promptFile.exists())) {
        logger.info(`Writing ${promptFile.name}...`);

        const stringifiedEntries = mapEntriesToPrompt(entries);

        const errors = stringifiedEntries.filter((s) => s.includes('span'));

        if (errors.length) {
            logger.warn(`Errors found: ${errors.join('\n')}`);
        }

        await promptFile.write(
            [TRANSLATE_PROMPT.join('\n').replace('{{book}}', title), '\n\n', stringifiedEntries.join('\n\n')].join(
                '\n',
            ),
        );
    }
};

const filterCoveredPagesFromBook = (book: BookData, coveredPages: number[]) => {
    const covered = new Set(coveredPages);
    const uncoveredPages = book.pages.filter((p) => !covered.has(p.id));

    return uncoveredPages;
};

const removeDuplicateTranslations = (translations: Translation[]) => {
    const result: Translation[] = [];
    const keyToTranslation: Record<string, Translation> = {};

    for (const translation of translations) {
        const key = getEntryKey(translation);

        if (keyToTranslation[key]) {
            keyToTranslation[key].translation += '\n\n' + translation.translation;
        } else {
            result.push(translation);
            keyToTranslation[key] = translation;
        }
    }

    return result;
};

const applyTranslationsToEntries = (entries: Entry[], translations: Translation[]) => {
    const updatedEntries: Entry[] = [];
    const { indexToEntries, pageToEntries } = indexEntriesByNumber(entries);

    const missing: string[] = [];

    for (const t of translations) {
        if (t.index) {
            const key = getEntryKey(t);

            if (!indexToEntries[key] || indexToEntries[key].length === 0) {
                missing.push(`${t.type ? 'Chapter' : 'Narration'} #${t.index} not found in Arabic pages`);
                continue;
            }

            const { index, type, ...entry } = indexToEntries[key].shift()!;

            updatedEntries.push({
                ...entry,
                ...((!type || type > 0) && { type }),
                translation: t.translation,
                translator: t.translator,
                ...(!t.type && index && { index }),
            });
        } else if (t.from) {
            if (!pageToEntries[t.from] || pageToEntries[t.from].length === 0) {
                console.error(`Loose entry at page ${t.from} not found in Arabic pages ${t}`);
                return [];
            }

            const entry = pageToEntries[t.from].shift()!;

            updatedEntries.push({
                ...entry,
                translation: t.translation,
                translator: t.translator,
            });
        } else {
            console.error(`Unknown translation: `, t);
            return [];
        }
    }

    if (missing.length) {
        console.error(missing);
        return [];
    }

    return updatedEntries;
};

export const saveEntries = async (entries: Entry[], isPreview: boolean) => {
    for (const entry of entries.toSorted((a, b) => a.from - b.from)) {
        if (entry.id) {
            logger.info(`Update ${JSON.stringify(entry, null, 2)}`);
        } else if (!entry.type) {
            logger.info(
                `Add new entry at page: ${magentaBright(entry.from)}${entry.to ? `-${magentaBright(entry.to)}` : ''} with index ${yellow(entry.index)}`,
            );
        } else if (entry.type === TYPE_CHAPTER) {
            logger.info(`Add new chapter at page: ${magentaBright(entry.from)}`);
        } else {
            logger.info(`Unknown entry type being added at: ${magentaBright(entry.from)}`);
        }

        if (isPreview) {
            logger.info(`Text: ${entry.translation}\n${entry.arabic}\n\n`);
        } else {
            await addOrUpdateEntry(entry);
        }
    }

    if (entries[0]?.url) {
        logger.info(`Using url: ${entries[0].url}`);
    }
};

export const processShamela = async () => {
    const { book, collection, dir, entriesToFilter, indexToEntries, max, pageToEntries, unused, url } =
        await loadData();

    if (unused === 'pages') {
        book.pages = filterCoveredPagesFromBook(book, Object.keys(pageToEntries).map(Number));
    }

    let arabicOnlyEntries: Partial<Entry>[] = mapBookPagesToEntries(book, {
        markerPattern: /^\[\] (.*)/,
        max,
    }).filter((e) => {
        return !e.to || e.to! - e.from! <= max;
    });

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

    const finalEntries = applyTranslationsToEntries(arabicOnlyEntries as Entry[], translations);

    for (const entry of finalEntries) {
        entry.collection = Number(collection.id);
        entry.flags = FLAGS_PENDING_REVIEW;
        entry.volume = entry.volume || 1;

        if (url) {
            entry.url = url;
        }
    }

    await saveEntries(finalEntries, logger.level === 'debug');
};
