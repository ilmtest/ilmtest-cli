import { Page } from '../../api/maktabah.js';

type PageRange = Page & {
    end?: number;
    footnotes?: string;
};

export const FOOTNOTES_SYMBOL = '_';

export const removeFootnotesFromPages = (pages: Page[], symbol = '_') => {
    return pages.map((page) => {
        const indexOfFootnote = page.body.indexOf(symbol);

        if (indexOfFootnote >= 0) {
            return page.body.slice(0, indexOfFootnote);
        }

        return page;
    });
};

const isNumericPrefix = (text: string) => {
    return /^\d+ [-–—]|^\d+ {2}|^\d+ «/.test(text);
};

const splitIndexFromText = (line: string) => {
    const index = line.slice(0, line.indexOf(' ')).trim();
    const text = line.slice(line.indexOf(' ') + 1).trim();

    return { index, text };
};

export const indexSpanningNarrations = (pages: Page[]) => {
    const indexToArabic: Record<string, PageRange> = {};
    const indexToText: Record<string, string[]> = {};

    let lastIndex = '';

    for (const page of pages) {
        page.body.split('\n').forEach((line) => {
            if (isNumericPrefix(line)) {
                const { index, text } = splitIndexFromText(line);

                if (!indexToArabic[index]) {
                    indexToArabic[index] = { ...page };
                    indexToText[index] = [text];
                    lastIndex = index;
                } else {
                    console.warn('mapIndexToPage Already', index);
                }
            } else if (lastIndex) {
                indexToText[lastIndex].push(line.trim());
                indexToArabic[lastIndex].end = page.page;
            }
        });
    }

    for (const [index, texts] of Object.entries(indexToText)) {
        indexToArabic[index] = {
            ...indexToArabic[index],
            body: texts
                .map((t) => t.trim())
                .filter(Boolean)
                .join('\n'),
        };
    }

    return indexToArabic;
};
