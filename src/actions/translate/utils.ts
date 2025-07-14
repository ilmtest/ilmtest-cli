import { convertArabicIndicToRoman, toTitleCase } from '@/utils/textUtils.js';

import type { Entry } from '../../api/entries.js';
import type { Page } from '../../api/maktabah.js';

export const PATTERNS = {
    AbdurrazaqLine: /^(ʿAbd al-Razzāq,?|Akhbaranā)$/g,
    ArabicText: /[\u0600-\u06FF]/,
    BodyReferences: /\s?(?<!^)-?\[\d+\]\s?/, // [1]
    HyphenPrefix: /^[-–] /g,
    NumberedMultilineText: /(?=^\d+\s*[-–—]\s*)/gm, // 1 - First item
    NumberedParagraph: /^(\d+) - (.*)$/gm,
    NumberedSahihJami: /(\d+) (?:[-–—] |\s+)(?:\d+ [-–—] )?(.*?)(?=\d+ (?:[-–—] |\s+)(?:\d+ [-–—] )?|$)/gs, // 1338 - 581 - text or 87  1 -[text]
    NumericPrefix: /^[-–] \d+ [-–] \d+ |^[-–] \d+ [-–] /g,
    SquareBracketReferencesWithColon: /-\[\d+\]: /g, // "-[123]: "
    SquareBracketReferencesWithDash: /(?<!^)-\[\d+\]/g, // "-[123]",
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
    pageToBab: Record<number, Page>,
    pageToEntry: Record<number, Entry>,
): Partial<Entry>[] => {
    let content = translationText
        .trim()
        .split('\n')
        .map((t) => t.trim())
        .filter(Boolean);
    const result: Partial<Entry>[] = [];
    const currentPageNumber = page.page;
    const entry = pageToEntry[currentPageNumber];

    if (content.length > 1) {
        // measure distance between here and the next chapter
        let totalAbwabPagesAfterCurrent = 0;

        for (let i = 1; i < content.length; i++) {
            if (pageToBab[currentPageNumber + i]) {
                totalAbwabPagesAfterCurrent++;
            } else {
                break;
            }
        }

        if (totalAbwabPagesAfterCurrent === 0) {
            // then it must all just be commentary on this existing page so do nothing
        } else if (totalAbwabPagesAfterCurrent <= content.length - 1) {
            const linesToDistribute = content.slice(totalAbwabPagesAfterCurrent);
            const merged = [linesToDistribute.join('\n')];
            //const merged = linesToDistribute;

            // distribute each line into each page
            merged.forEach((title, i) => {
                const chapterPage = pageToBab[currentPageNumber + i + 1];

                const chapterEntry = pageToEntry[chapterPage.page];

                if (chapterEntry) {
                    result.push(createPatch(chapterEntry, title));
                } else {
                    result.push(createNewEntryFromPage(chapterPage, title, undefined, 2) as Entry);
                }
            });

            content = content.slice(0, totalAbwabPagesAfterCurrent);
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

export const mapLinesToEntries = (
    lines: string[],
    indexToPage: Record<string, Page>,
    pageToChapter: Record<number, Page>,
    pageToEntry: Record<number, Entry>,
    collection: number,
    translator: number,
) => {
    const entries = lines.flatMap((line) => {
        const [, index, content] = line.match(/^(\d+) [-–] (.*)/s) || [];

        if (index && content) {
            try {
                return mapLineToEntry(Number(index), content, indexToPage[index], pageToChapter, pageToEntry);
            } catch (err: any) {
                err.index = index;
                err.content = content;
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

export const sanitizePageBody = (page: Page) => {
    return {
        ...page,
        body: convertArabicIndicToRoman(page.body)
            .replace(PATTERNS.SquareBracketReferencesWithColon, '')
            .replace(PATTERNS.SquareBracketReferencesWithDash, ''),
    };
};

export const sanitizeTranslation = (text: string) => {
    return (
        text
            //.replace(PATTERNS.AbdurrazaqLine, '')
            //.replace(PATTERNS.BodyReferences, '')
            .split(PATTERNS.NumberedMultilineText)
            //.filter((entry) => !PATTERNS.ArabicText.test(entry))
            //.split('\n')
            .filter((entry) => entry.trim())
    );
};

export const indexArabicPages = (pages: Page[]) => {
    const indexToArabic: Record<string, Page> = {};
    const pageToBab: Record<string, Page> = {};

    for (const page of pages) {
        const body = page.body;

        // Check if no matches found by converting iterator to array
        const matchesArray = [...body.matchAll(PATTERNS.NumberedParagraph)];

        if (matchesArray.length === 0) {
            pageToBab[page.page] = page;
        }

        for (const [, index, body] of matchesArray) {
            indexToArabic[index] = { ...page, body };
        }
    }

    return { indexToArabic, pageToBab };
};

const splitIndexFromText = (line: string) => {
    const index = line.slice(0, line.indexOf(' ')).trim();
    const text = line.slice(line.indexOf(' ') + 1).trim();

    return { index, text };
};

export const mapEntriesToUpdates = (entries: Entry[], indexToEntry: Record<number, Entry>) => {
    const newEntries: Entry[] = [];
    const entriesToUpdate: Partial<Entry>[] = [];

    entries.forEach(({ id, ...e }) => {
        if (e.index && indexToEntry[e.index]) {
            const patchedEntry = createPatch(indexToEntry[e.index], e.translation!);
            entriesToUpdate.push(patchedEntry);
        } else {
            newEntries.push(e as Entry);
        }
    });

    return { entriesToUpdate, newEntries };
};

type PageRange = Page & {
    end?: number;
};

export const mapIndexToPage = (pages: Page[], discardFootnotes = false) => {
    const indexToArabic: Record<string, PageRange> = {};
    const indexToText: Record<string, string[]> = {};

    let lastIndex = '';

    for (const page of pages) {
        const body =
            discardFootnotes && page.body.includes('_') ? page.body.slice(0, page.body.indexOf('_')) : page.body;

        body.split('\n').forEach((line) => {
            if (/^\d+ [-–—]|^\d+ {2}|^\d+ «/.test(line)) {
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

export const mapIndexToText = (lines: string[]) => {
    const indexToText: Record<string, string[]> = {};

    let lastIndex = '';

    for (const line of lines) {
        if (/^\d+ [-–—]/.test(line)) {
            const { index, text } = splitIndexFromText(line);

            if (indexToText[index]) {
                console.warn('mapIndexToText Already', index);
            } else {
                indexToText[index] = [text];
                lastIndex = index;
            }
        } else if (lastIndex) {
            indexToText[lastIndex].push(line.trim());
        }
    }

    const result: Record<string, string> = {};

    for (const [index, texts] of Object.entries(indexToText)) {
        result[index] = texts.join('\n');
    }

    return result;
};

export const indexEntriesByPage = (entries: Entry[]) => {
    const indexToEntry: Record<number, Entry> = {};

    for (const entry of entries) {
        indexToEntry[entry.from] = entry;
    }

    return indexToEntry;
};

export const indexEntriesByNumber = (entries: Entry[]) => {
    const indexToEntry: Record<number, Entry> = {};

    for (const entry of entries) {
        if (entry.index) {
            indexToEntry[entry.index] = entry;
        }
    }

    return indexToEntry;
};
