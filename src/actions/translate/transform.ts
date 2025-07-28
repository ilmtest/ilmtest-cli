import { Page } from '../../api/maktabah.js';

export const FOOTNOTES_SYMBOL = '_';

export const removeFootnotesFromPages = (pages: Page[], symbol = '_') => {
    return pages.map((page) => {
        const indexOfFootnote = page.body.lastIndexOf(symbol);

        if (indexOfFootnote >= 0) {
            return { ...page, body: page.body.slice(0, indexOfFootnote) };
        }

        return page;
    });
};
