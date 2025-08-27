import type { Page } from '../../api/maktabah.js';

import { createChapterEntry, createEntryFromPage, TYPE_BOOK } from './mapping.js';
import { PATTERNS } from './patterns.js';
import {
    createKitabProcessor,
    createNumberedParagraphProcessor,
    createSimpleBabProcessor,
} from './processors/handlers.js';
import { indexPages } from './processors/index.js';
import { validateIndices } from './validation.js';

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
            if (text.trim()) {
                indexToText[index] = text;
            }

            lastIndex = index;
        }
    }

    return { indexToBook, indexToChapter, indexToText };
};

export const indexDiscretePagesToEntries = (pages: Page[], translationLines: string[], translatorId: string) => {
    const { indexToBook, indexToChapter, indexToText } = indexDiscreteTranslations(
        translationLines,
        PATTERNS.MatchNumericListItem,
        /^\D+/,
        //PATTERNS.ChapterTitles,
        PATTERNS.BookTitles,
    );

    const { indexToBab, indexToKitab, indexToMatn } = indexPages(pages, [
        createKitabProcessor(PATTERNS.NumberedKitabTitles),
        //createSimpleBabProcessor(buildDiacriticsInsensitiveExactRegex('باب', 'مساله', 'حديث', 'ما')),
        createSimpleBabProcessor(/^\D+/),
        createNumberedParagraphProcessor(PATTERNS.MatchNumberedParagraph),
    ]);

    let missing = validateIndices(Object.keys(indexToKitab), Object.keys(indexToBook));

    if (missing.length) {
        console.error('indexToKitab', indexToKitab);
        console.error('indexToBook', indexToBook);
        throw new Error(`Book Indexes ${missing.sort().join(', ')} are missing from Arabic.`);
    }

    missing = validateIndices(Object.keys(indexToBab), Object.keys(indexToChapter));

    if (missing.length) {
        console.error(
            'indexToBab',
            Object.fromEntries(Object.entries(indexToBab).sort(([a], [b]) => a.localeCompare(b))),
        );
        console.error(
            'indexToChapter',
            Object.fromEntries(Object.entries(indexToChapter).sort(([a], [b]) => a.localeCompare(b))),
        );
        throw new Error(`Chapter Indexes ${missing.sort().join(', ')} are missing from Arabic.`);
    }

    missing = validateIndices(Object.keys(indexToMatn), Object.keys(indexToText));

    if (missing.length) {
        console.error('indexToMatn', indexToMatn);
        console.error('indexToText', indexToText);
        throw new Error(`Matn Indexes ${missing.sort().join(', ')} are missing from Arabic.`);
    }

    const entries = Object.entries(indexToText).map(([index, translation]) => {
        const page = indexToMatn[index];
        return createEntryFromPage(page, index, translation, translatorId);
    });

    const chapters = Object.entries(indexToChapter).map(([index, translation]) => {
        const page = indexToBab[index];
        return createChapterEntry(page, translation, translatorId);
    });

    const books = Object.entries(indexToBook).map(([index, translation]) => {
        const page = indexToKitab[index];
        return createEntryFromPage(page, '', translation, translatorId, undefined, TYPE_BOOK);
    });

    return [...entries, ...chapters, ...books];
};
