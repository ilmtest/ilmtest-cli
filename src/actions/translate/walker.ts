/* eslint-disable prefer-const */
import { Entry } from '@/api/entries.js';

import type { Bookmark, Page } from '../../api/maktabah.js';
import type { PageRange } from './types.js';

import { createChapterEntry, createEntryFromPage, createEntryFromPageRange, TYPE_BOOK } from './mapping.js';
import { PATTERNS } from './patterns.js';
import { validateIndices } from './validation.js';

type WalkAndIndexPagesOptions = {
    bookmarks: Bookmark[];
    narrationPattern: RegExp;
    stopPattern?: RegExp;
};

const indexBookmarks = (bookmarks: Bookmark[]) => {
    const pageToBookmarks: Record<number, Bookmark> = {};

    for (const bookmark of bookmarks) {
        pageToBookmarks[bookmark.page] = bookmark;
    }

    return pageToBookmarks;
};

export const walkAndIndexPages = (
    pages: Page[],
    { bookmarks, narrationPattern, stopPattern }: WalkAndIndexPagesOptions,
) => {
    const indexToMatn: Record<string, PageRange> = {};
    const indexToLines: Record<string, string[]> = {};
    const pageToBookmarks = indexBookmarks(bookmarks);
    let lastIndex = '';

    for (const page of pages) {
        const bookmark = pageToBookmarks[page.page];

        if (lastIndex && bookmark?.level) {
            indexToMatn[`${lastIndex}/${bookmark.level}`] = { ...page };
            lastIndex = '';
        }

        page.body
            .split('\n')
            .filter((line) => line.trim())
            .forEach((line) => {
                const [, index, text] = line.match(narrationPattern) || [];

                if (line.includes('تلخيص الذهبي')) {
                    const [, refIndex, commentary] = line.match(/(\d+)\s?[-–—ـ](.*)/) || [];
                    lastIndex = refIndex;
                    line = `الذهبي: ${commentary}`;
                }

                if (stopPattern?.test(line)) {
                    lastIndex = '';
                } else if (index && text && !indexToMatn[index]) {
                    indexToMatn[index] = { ...page };
                    indexToLines[index] = [text];
                    lastIndex = index;
                } else if (lastIndex) {
                    indexToLines[lastIndex].push(line.trim());

                    if (indexToMatn[lastIndex].page !== page.page) {
                        indexToMatn[lastIndex].end = page.page;
                    }
                }
            });
    }

    for (const [index, texts] of Object.entries(indexToLines)) {
        indexToMatn[index] = {
            ...indexToMatn[index],
            body: texts
                .map((t) => t.trim())
                .filter(Boolean)
                .join('\n'),
        };
    }

    return indexToMatn;
};

export const walkAndIndexLines = (lines: string[], pattern = PATTERNS.MatchNumericListItem) => {
    const indexToLines: Record<string, string[]> = {};

    let lastIndex = '';

    for (const line of lines) {
        if (line.startsWith('The Book') || line.startsWith('Book of')) {
            lastIndex += '/1';
            indexToLines[lastIndex] = [];
        }

        const [, index, text] = line.match(pattern) || [];

        if (index && text && !indexToLines[index]) {
            indexToLines[index] = [text];
            lastIndex = index;
        } else if (lastIndex) {
            indexToLines[lastIndex].push(line.trim());
        }
    }

    const result: Record<string, string> = {};

    for (const [index, texts] of Object.entries(indexToLines)) {
        result[index] = texts.map((t) => t.trim()).join('\n');
    }

    return result;
};

export const walkAndMapPagesToEntries = (
    pages: Page[],
    translationLines: string[],
    translatorId: string,
    bookmarks: Bookmark[],
) => {
    const indexToMatn = walkAndIndexPages(pages, {
        bookmarks,
        narrationPattern: PATTERNS.MatchNumericListItem,
    });

    const indexToTranslation = walkAndIndexLines(translationLines);

    validateIndices(Object.keys(indexToMatn), Object.keys(indexToTranslation));

    const entries: Entry[] = [];

    for (let [index, translation] of Object.entries(indexToTranslation)) {
        const page = indexToMatn[index];

        if (!page) {
            console.error('Index not found in Arabic pages:', index);
            return [];
        }

        if (index.endsWith('/1')) {
            entries.push(createEntryFromPage(page, '', translation, translatorId, undefined, TYPE_BOOK));
        } else if (indexToMatn[`${index}/2`]) {
            if (translation.includes('\n')) {
                const lines = translation.split('\n');
                entries.push(createChapterEntry(page, lines.at(-1)!, translatorId));
                translation = lines.slice(0, -1).join('\n');
            } else {
                console.warn('Chapter translation was not found for', index);
            }
        }

        entries.push(createEntryFromPageRange(page, index, translation, translatorId));
    }

    return entries;
};
