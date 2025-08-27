import { isAllUppercase, toTitleCase } from 'bitaboom';

import type { Entry } from '../../api/entries.js';
import type { Page } from '../../api/maktabah.js';
import type { PageRange } from './types.js';

export const FLAGS_PENDING_REVIEW = 3;

export const TYPE_CHAPTER = 2;

export const TYPE_BOOK = 1;

export const createBaseEntryFromPage = (page: Page, arabic: string, index: string) => {
    return {
        arabic,
        collection: Number(page.collection),
        from: page.page,
        index: parseInt(index),
        pp: page.pp,
        volume: page.volume,
    } as Entry;
};

export const createEntryFromPage = (
    page: Page,
    index: string,
    translation: string,
    translatorId: string,
    flags = FLAGS_PENDING_REVIEW,
    type?: number,
) => {
    return {
        ...createBaseEntryFromPage(page, page.body, index),
        flags,
        translation,
        translator: Number(translatorId),
        ...(type && { type }),
    } as Entry;
};

export const createChapterEntry = (page: Page, title: string, translatorId: string) => {
    return createEntryFromPage(
        page,
        '',
        isAllUppercase(title) ? toTitleCase(title) : title,
        translatorId,
        undefined,
        TYPE_CHAPTER,
    );
};

export const createEntryFromPageRange = (
    page: PageRange,
    index: string,
    translation: string,
    translatorId: string,
): Entry => {
    return {
        ...createEntryFromPage(page, index, translation, translatorId),
        ...(page.end && { to: page.end }),
    };
};
