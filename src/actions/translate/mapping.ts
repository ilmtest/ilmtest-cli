import type { Entry } from '../../api/entries.js';
import type { PageRange } from './types.js';

export const createEntryFromPageRange = (
    page: PageRange,
    index: string,
    translation: string,
    translatorId: string,
    flags = 3,
) => {
    return {
        arabic: page.body,
        collection: Number(page.collection),
        flags,
        from: page.page,
        ...(page.end && { to: page.end }),
        index: Number(index),
        pp: page.pp,
        translation: translation,
        translator: Number(translatorId),
        volume: page.volume,
    } as Entry;
};
