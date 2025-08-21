import type { Page } from '../../api/maktabah.js';
import type { PageRange } from './types.js';

import { createEntryFromPageRange } from './mapping.js';
import { PATTERNS } from './patterns.js';
import { buildDiacriticsInsensitiveExactRegex } from './processors/utils.js';

type WalkAndIndexPagesOptions = {
    narrationPattern: RegExp;
    stopPattern: RegExp;
};

export const walkAndIndexPages = (pages: Page[], { narrationPattern, stopPattern }: WalkAndIndexPagesOptions) => {
    const indexToMatn: Record<string, PageRange> = {};
    const indexToLines: Record<string, string[]> = {};

    let lastIndex = '';

    for (const page of pages) {
        page.body
            .split('\n')
            .filter((line) => line.trim())
            .forEach((line) => {
                // eslint-disable-next-line prefer-const
                let [, index, text] = line.match(narrationPattern) || [];

                if (text?.trim().startsWith('باب')) {
                    index = `c${index}`;
                } else if (line.startsWith('باب')) {
                    console.log('chapter without number', lastIndex);
                    lastIndex = '';
                }

                if (stopPattern.test(line)) {
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

                if (line.endsWith('(متفق عليه).') || line.endsWith('رواه مسلم')) {
                    lastIndex = '';
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

type JamiScrapiResult = {
    pages: { body?: string; index: string; page: number; title?: string }[];
    urlPattern: string;
};

export const walkAndMapPagesToEntries = async (pages: Page[], translatorId: string) => {
    const indexToMatn: Record<string, Page> = pages.reduce(
        (acc, p) => {
            const [index] = p.body.match(/\[تعليق مصطفى البغا\] (\d+) /) || [];

            if (index) {
                acc[index] = p;
            }

            return acc;
        },
        {} as Record<string, Page>,
    );

    if (1 === Number(1)) {
        return;
    }

    const jamiScrapi: JamiScrapiResult = await Bun.file('tmp/335/translation.json').json();

    const indexToChapter: Record<string, string> = jamiScrapi.pages
        .filter((p) => p.title)
        .reduce((acc, p) => {
            return { ...acc, [p.index]: p.title! };
        }, {});
    const indexToUrl: Record<string, string> = jamiScrapi.pages
        .filter((p) => p.title)
        .reduce((acc, p) => {
            return { ...acc, [p.index]: jamiScrapi.urlPattern.replace('{{page}}', p.page.toString()) };
        }, {});

    const entries = Object.entries(indexToMatn)
        .filter(([index]) => index.startsWith('c'))
        .map(([idx, page]) => {
            const index = idx.slice(1);
            const translation = indexToChapter[index];
            const result = createEntryFromPageRange(page, index, translation, translatorId);
            return { ...result, type: 2, url: indexToUrl[index] };
        });

    return entries;
};
