import type { Entry } from '../../api/entries.js';
import type { Page } from '../../api/maktabah.js';

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
            // distribute each line into each page
            content.slice(totalAbwabPagesAfterCurrent).forEach((title, i) => {
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
        const [, index, content] = line.match(/^(\d+) - (.*)/s) || [];

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
        body: page.body
            .replace(/-\[\d+\]: /g, '') // Remove "-[123]: " pattern
            .replace(/(?<!^)-\[\d+\]/g, ''), // Remove "-[123]" pattern
    };
};

export const sanitizeTranslation = (text: string) => {
    return (
        text
            .replace(/^(ʿAbd al-Razzāq,?|Akhbaranā)$/g, '')
            //.replace(/\s?(?<!^)-?\[\d+\]\s?/, '')
            .split(/(?=^\d+\s*[-–—]\s*)/gm)
            .filter((entry) => !/[\u0600-\u06FF]/.test(entry))
            .filter((entry) => entry.trim())
    );
};

export const indexArabicPages = (pages: Page[]) => {
    const indexToArabic: Record<string, Page> = {};
    const pageToBab: Record<string, Page> = {};

    for (const page of pages) {
        // Check if no matches found by converting iterator to array
        const matchesArray = [...page.body.matchAll(/^(\d+) - (.*)$/gm)];

        if (matchesArray.length === 0) {
            pageToBab[page.page] = page;
        }

        for (const [, index, body] of matchesArray) {
            indexToArabic[index] = { ...page, body };
        }
    }

    return { indexToArabic, pageToBab };
};

export const indexEntriesByPage = (entries: Entry[]) => {
    const indexToEntry: Record<number, Entry> = {};

    for (const entry of entries) {
        indexToEntry[entry.from] = entry;
    }

    return indexToEntry;
};
