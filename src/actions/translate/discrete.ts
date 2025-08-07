import { stripDiacritics } from 'bitaboom';

import type { Page } from '../../api/maktabah.js';

import {
    createKitabProcessor,
    createNumberedParagraphProcessor,
    createSimpleBabProcessor,
} from '../processors/handlers.js';
import { indexPages } from '../processors/index.js';
import { buildDiacriticsInsensitiveExactRegex, makeDiacriticInsensitive } from '../processors/utils.js';
import { createEntryFromPage, TYPE_BOOK, TYPE_CHAPTER } from './mapping.js';
import { PATTERNS } from './patterns.js';
import { validateIndices } from './validation.js';

export const indexDiscretePages = (
    pages: Page[],
    narrationPattern: RegExp,
    babPattern?: RegExp,
    kitabPattern?: RegExp,
) => {
    const indexToMatn: Record<string, Page> = {};
    const indexToBab: Record<string, Page> = {};
    const indexToKitab: Record<string, Page> = {};
    let lastIndex = '';

    for (const page of pages) {
        let body = page.body;

        if (lastIndex) {
            if (kitabPattern && stripDiacritics(body).match(kitabPattern)) {
                indexToKitab[lastIndex] = page;
                continue;
            }

            const [, babMatch, rest] = babPattern ? body.match(babPattern) || [] : [];

            if (babMatch) {
                if (indexToBab[lastIndex]) {
                    lastIndex += '.';
                }

                indexToBab[lastIndex] = { ...page, body: babMatch.trim() };
                body = rest || '';
            }
        }

        const matchesArray = [...body.matchAll(narrationPattern)];

        for (const [, index, text] of matchesArray) {
            if (index && text && !indexToMatn[index]) {
                indexToMatn[index] = { ...page, body: text.trim() };
                lastIndex = index;
            }
        }
    }

    return { indexToBab, indexToKitab, indexToMatn };
};

export const indexDiscreteTranslations = (
    lines: string[],
    hadithPattern: RegExp,
    chapterPattern?: RegExp,
    bookPattern?: RegExp,
) => {
    const indexToText: Record<string, string> = {};
    const indexToChapter: Record<string, string> = {};
    const indexToBook: Record<string, string> = {};

    let lastIndex = '';

    for (const line of lines) {
        if (lastIndex) {
            if (bookPattern && line.match(bookPattern)) {
                indexToBook[lastIndex] = line;
                continue;
            }

            if (chapterPattern && line.match(chapterPattern)) {
                if (indexToChapter[lastIndex]) {
                    lastIndex += '.';
                }

                indexToChapter[lastIndex] = line;
                continue;
            }
        }

        const [, index, text] = line.match(hadithPattern) || [];

        if (!index && lastIndex && indexToChapter[lastIndex]) {
            // continuation of a chapter that has multiple lines
            indexToChapter[lastIndex] = [indexToChapter[lastIndex], line].join('\n');
        }

        if (index && text && !indexToText[index]) {
            indexToText[index] = text;
            lastIndex = index;
        }
    }

    return { indexToBook, indexToChapter, indexToText };
};

export const indexDiscretePagesToEntries = (pages: Page[], translationLines: string[], translatorId: string) => {
    /*const { indexToBab, indexToKitab, indexToMatn } = indexDiscretePages(
        pages,
        PATTERNS.MatchNumberedParagraph,
        PATTERNS.MatchBabTitlesUpToNumberedListItem,
        PATTERNS.KitabPrefix,
    ); */
    const { indexToBook, indexToChapter, indexToText } = indexDiscreteTranslations(
        translationLines,
        PATTERNS.MatchNumericListItem,
        PATTERNS.ChapterTitles,
        PATTERNS.BookTitles,
    );

    const { indexToBab, indexToKitab, indexToMatn } = indexPages(pages, [
        createKitabProcessor(PATTERNS.KitabPrefix),
        createSimpleBabProcessor(buildDiacriticsInsensitiveExactRegex('باب', 'جماع')),
        createNumberedParagraphProcessor(PATTERNS.MatchNumberedParagraph),
    ]);

    try {
        validateIndices(Object.keys(indexToKitab), Object.keys(indexToBook));
    } catch (err) {
        console.error('indexToKitab', indexToKitab);
        console.error('indexToBook', indexToBook);
        throw err;
    }

    try {
        validateIndices(Object.keys(indexToBab), Object.keys(indexToChapter));
    } catch (err) {
        console.error('indexToBab', indexToBab);
        console.error('indexToChapter', indexToChapter);
        throw err;
    }

    try {
        validateIndices(Object.keys(indexToMatn), Object.keys(indexToText));
    } catch (err) {
        console.error('indexToMatn', indexToMatn);
        console.error('indexToText', indexToText);
        throw err;
    }

    const entries = Object.entries(indexToText).map(([index, translation]) => {
        const page = indexToMatn[index];
        return createEntryFromPage(page, index, translation, translatorId);
    });

    const chapters = Object.entries(indexToChapter).map(([index, translation]) => {
        const page = indexToBab[index];
        return createEntryFromPage(page, '', translation, translatorId, undefined, TYPE_CHAPTER);
    });

    const books = Object.entries(indexToBook).map(([index, translation]) => {
        const page = indexToKitab[index];
        return createEntryFromPage(page, '', translation, translatorId, undefined, TYPE_BOOK);
    });

    return [...entries, ...chapters, ...books];
};
