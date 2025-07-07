import { magentaBright, yellow } from 'ansis';
import { stripDiacritics } from 'bitaboom';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { getNumericInput } from '@/utils/io.js';

import { addOrUpdateEntry, Entry, getEntries } from '../api/entries.js';
import { getPages, Page } from '../api/maktabah.js';
import logger from '../utils/logger.js';

const ARABIC_CHAPTER_MARKERS = ['حديث', 'باب'];
const ENGLISH_CHAPTER_MARKERS = ['Chapter', 'Ḥadīth', 'The Ḥadīth', 'The ḥadīth', 'CHAPTER'];

const CHAPTER_MARKERS = {
    arabic: new RegExp(`^(${ARABIC_CHAPTER_MARKERS.join('|')})`, 'g'),
    translation: new RegExp(`^(${ENGLISH_CHAPTER_MARKERS.join('|')})`, 'g'),
};

const OUTPUT_DIR = 'tmp';

export const loadOrDownload = async <T>(
    fileName: string,
    getter: (collectionId: string) => Promise<T[]>,
    collectionId: string,
    dir: string,
): Promise<T[]> => {
    const file = Bun.file(path.format({ dir, ext: '.json', name: fileName }));

    if (await file.exists()) {
        return file.json();
    } else {
        logger.info(`Downloading ${fileName}`);
        const data = await getter(collectionId);

        logger.info(`Saving ${fileName}`);
        await file.write(JSON.stringify(data));

        return data;
    }
};

const INDEXED_NARRATION_REGEX = /^(\d+) - (.*)$/gm;

const sanitizePageBody = (page: Page) => {
    return {
        ...page,
        body: page.body
            .replace(/-\[\d+\]: /g, '') // Remove "-[123]: " pattern
            .replace(/(?<!^)-\[\d+\]/g, ''), // Remove "-[123]" pattern
    };
};

const indexArabicPages = (pages: Page[]) => {
    const indexToArabic: Record<string, Page> = {};

    for (const page of pages) {
        const matches = page.body.matchAll(INDEXED_NARRATION_REGEX);

        for (const [, index, body] of matches) {
            indexToArabic[index] = { ...page, body };
        }
    }

    return indexToArabic;
};

const indexChapters = (pages: Page[]) => {
    const pageToArabic: Record<number, Page> = {};

    pages
        .filter((p) => {
            const sanitized = stripDiacritics(p.body);
            return CHAPTER_MARKERS.arabic.test(sanitized);
        })
        .forEach((p) => {
            pageToArabic[p.page] = p;
        });

    return pageToArabic;
};

const indexEntriesByPage = (entries: Entry[]) => {
    const indexToEntry: Record<number, Entry> = {};

    for (const entry of entries) {
        indexToEntry[entry.from] = entry;
    }

    return indexToEntry;
};

const getTranslatedData = async (dir: string) => {
    const translationFile = Bun.file(path.format({ dir, ext: '.txt', name: 'translation' }));

    if (!(await translationFile.exists())) {
        await Bun.file(path.format({ dir, ext: '.txt', name: 'translation' })).write('');
    }

    const lines = (await translationFile.text())
        .replace(/^(ʿAbd al-Razzāq,?|Akhbaranā)$/g, '')
        .split(/(?=^\d+ - )/gm)
        .filter((entry) => entry.trim());

    return lines;
};

const createNewEntryFromPage = (page: Page, body: string, index?: number, type?: number) => {
    return {
        arabic: page.body,
        from: page.page,
        ...(index && { index }),
        pp: page.pp,
        translation: body,
        ...(type && { type }),
        volume: page.volume,
    };
};

const createPatch = (entry: Entry, translation: string) => {
    return {
        flags: 4,
        id: entry.id,
        translation: [entry.translation, translation].join('\n\n'),
    };
};

const mapLineToEntry = (
    index: number,
    translationText: string,
    page: Page,
    pageToChapter: Record<number, Page>,
    pageToEntry: Record<number, Entry>,
): Partial<Entry>[] => {
    let content = translationText
        .trim()
        .split('\n')
        .map((t) => t.trim())
        .filter(Boolean);
    const result: Partial<Entry>[] = [];

    const indexOfChapter = content.findIndex((t) => {
        return CHAPTER_MARKERS.translation.test(t);
    });
    const entry = pageToEntry[page.page];

    if (indexOfChapter !== -1) {
        const chapterTitle = content.slice(indexOfChapter).join('\n');

        // no chapter, just extra commentary
        content = content.slice(0, indexOfChapter);

        const chapterPage = pageToChapter[page.page + 1];
        const chapterEntry = pageToEntry[chapterPage.page];

        if (chapterEntry) {
            result.push(createPatch(chapterEntry, chapterTitle));
        } else {
            result.push(createNewEntryFromPage(chapterPage, chapterTitle, undefined, 2) as Entry);
        }
    }

    const body = content.join('\n');

    if (entry && entry.index === index) {
        result.push(createPatch(entry, body));
    } else {
        result.push(createNewEntryFromPage(page, body, index) as Entry);
    }

    return result;
};

const mapLinesToEntries = (
    lines: string[],
    indexToPage: Record<string, Page>,
    pageToChapter: Record<number, Page>,
    pageToEntry: Record<number, Entry>,
    collection: number,
    translator: number,
) => {
    const entries = lines.flatMap((line) => {
        const [, index, content] = line.match(/^(\d+) - (.*)/s) || [];

        if (index && content) {
            try {
                return mapLineToEntry(Number(index), content, indexToPage[index], pageToChapter, pageToEntry);
            } catch (err: any) {
                logger.error(`index: ${index}, content: ${content}, ${err.stack}`);
                throw err;
            }
        }

        return [];
    });

    return {
        entriesToUpdate: entries.filter((e) => e.id),
        newEntries: entries.filter((e) => !e.id).map((e) => ({ ...e, collection, flags: 3, translator })) as Entry[],
    };
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

    const { entriesToUpdate, newEntries } = mapLinesToEntries(
        lines,
        indexArabicPages(pages),
        indexChapters(pages),
        indexEntriesByPage(await loadOrDownload<Entry>('entries', getEntries, collectionId, dir)),
        Number(collectionId),
        Number(translatorId),
    );

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
