import type { Entry } from '../../api/entries.js';
import type { Page } from '../../api/maktabah.js';
import type { PageRange } from './types.js';

export const FLAGS_PENDING_REVIEW = 3;

export const TYPE_CHAPTER = 2;

export const TYPE_BOOK = 1;

export const createEntryFromPage = (
    page: Page,
    index: string,
    translation: string,
    translatorId: string,
    flags = FLAGS_PENDING_REVIEW,
    type?: number,
) => {
    return {
        arabic: page.body,
        collection: Number(page.collection),
        flags,
        from: page.page,
        index: Number(index),
        pp: page.pp,
        translation,
        translator: Number(translatorId),
        volume: page.volume,
        ...(type && { type }),
    } as Entry;
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
