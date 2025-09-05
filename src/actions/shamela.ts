import { magentaBright, yellow } from 'ansis';
import { areSimilarAfterNormalization, calculateSimilarity, normalizeArabicText } from 'baburchi';
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

const parseInputArgs = () => {
    const { values } = parseArgs({
        options: {
            collection: {
                type: 'string',
            },
            log: {
                type: 'string',
            },
            migrate: {
                type: 'boolean',
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

    return { collectionId: values.collection, from, migrate: Boolean(values.migrate), to };
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

const loadData = async (options: LoadDataOptions = {}) => {
    const { collectionId, from, to } = parseInputArgs();

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

    return { book, collection, dir, ...indexEntriesByNumber(entries), entries };
};

type MapBookPagesToEntriesOptions = {
    indexLoosePages?: boolean;
};

const mapBookPagesToEntries = (book: BookData, options: MapBookPagesToEntriesOptions = {}) => {
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

            const lastEntry = entries.at(-1)!;

            if (options.indexLoosePages && lastEntry.from !== page.id) {
                entries.push({
                    ...entry,
                    arabic: line.text.trim(),
                });

                continue;
            }

            if (entries.length > 0) {
                lastEntry.arabic += '\n' + line.text.trim();

                if (lastEntry.from !== page.id) {
                    lastEntry.to = page.id;
                }
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

const loadTranslations = async (dir: string) => {
    const file = await getTranslationFile(dir, ['873', '879']);

    if (!file) {
        return [];
    }

    const translations: Translation[] = [];
    const lines = (await file.text())
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

    for (const line of lines) {
        let [, index, text] = line.match(/^C(\d+)\s?[-–—ـ](.*)/) || [];

        if (index && text) {
            translations.push({ index: parseInt(index), translation: text, type: TYPE_CHAPTER });
            continue;
        }

        [, index, text] = line.match(/^P(\d+)\s?[-–—ـ](.*)/) || [];

        if (index && text) {
            translations.push({ from: parseInt(index), translation: text });
            continue;
        }

        [, index, text] = line.match(PATTERNS.MatchNumericListItem) || [];

        if (index && text) {
            translations.push({ index: parseInt(index), translation: isAllUppercase(text) ? toTitleCase(text) : text });
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

const filterLongEntry = (e: Entry) => {
    return !e.to || e.to! - e.from < 2;
};

const applyTranslationsToEntries = (entries: Entry[], translations: Translation[]) => {
    const updatedEntries: Entry[] = [];
    const { indexToEntries, pageToEntries } = indexEntriesByNumber(entries);

    for (const t of translations) {
        if (t.index) {
            const key = getEntryKey(t);

            if (!indexToEntries[key] || indexToEntries[key].length === 0) {
                console.error(`${t.type ? 'Chapter' : 'Narration'} #${t.index} not found in Arabic pages`);
                return [];
            }

            const { index, ...entry } = indexToEntries[key].shift()!;

            updatedEntries.push({
                ...entry,
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

    return updatedEntries;
};

const saveEntries = async (entries: Entry[], isPreview: boolean) => {
    for (const entry of entries.toSorted((a, b) => a.from - b.from)) {
        if (!entry.type) {
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

export const processShamela = async () => {
    const { book, collection, dir, pageToEntries } = await loadData();
    book.pages = filterCoveredPagesFromBook(book, Object.keys(pageToEntries).map(Number));

    const arabicOnlyEntries: Partial<Entry>[] = mapBookPagesToEntries(book).filter(filterLongEntry as any);

    await generatePrompt(dir, collection.title, arabicOnlyEntries);

    const translations = await loadTranslations(dir);
    const finalEntries = applyTranslationsToEntries(arabicOnlyEntries as Entry[], translations);

    for (const entry of finalEntries) {
        entry.collection = Number(collection.id);
        entry.flags = FLAGS_PENDING_REVIEW;
    }

    await saveEntries(finalEntries, logger.level === 'debug');
};

const createPatch = (originalEntry: Entry, newPage: Entry) => {
    return {
        from: newPage.from,
        id: originalEntry.id,
        pp: newPage.pp,
        ...(newPage.volume && { volume: newPage.volume }),
        ...(originalEntry.to && { to: newPage.from + 1 }),
    };
};

export const migrateEntries = async () => {
    const { book, entries } = await loadData({ loadFullEntries: true });
    const arabicEntries = mapBookPagesToEntries(book, { indexLoosePages: true }).map(
        (e) => ({ ...e, arabic: normalizeArabicText(e.arabic!) }) as Entry,
    );

    const { indexToEntries, pageToEntries } = indexEntriesByNumber(arabicEntries);

    const updatedEntries: Partial<Entry>[] = entries.flatMap((e) => {
        const normalizedArabic = normalizeArabicText(e.arabic!);

        if (e.index) {
            const [entry] = indexToEntries[getEntryKey(e)];

            if (entry.from === e.from) {
                //console.log('Unchanged!');
                // page has not changed in this new version, no-op
                return [];
            }

            if (calculateSimilarity(normalizedArabic, entry.arabic!) >= 0.6) {
                // page has shifted but kept the same index
                return [createPatch(e, entry)];
            }

            // page has shifted, but the texts don't match
            console.warn(
                `Index no longer matches text for id: ${e.id}, #${e.index} at page ${e.from} vs. ${entry.from}`,
            );

            return [];
        }

        const [entry] = pageToEntries[e.from];

        if (calculateSimilarity(normalizedArabic, entry.arabic!) >= 0.6) {
            // non-numeric page but the page number is intact
            return [];
        }

        // page text does not match, we need to find the correct page
        const [similar, another] = arabicEntries.filter((a) => calculateSimilarity(normalizedArabic, a.arabic!) >= 0.6);

        if (!similar) {
            throw new Error(`Similar text not found for ${e.id}`);
        }

        if (another) {
            throw new Error(
                `Multiple similar entries found: ${JSON.stringify(e, null, 2)} with ${JSON.stringify([similar, another], null, 2)}`,
            );
        }

        return [createPatch(e, similar)];
    });

    await saveEntries(updatedEntries as Entry[], logger.level === 'debug');
};
