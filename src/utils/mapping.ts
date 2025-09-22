import { type Page, parseContentRobust } from 'shamela';

import { type Entry, EntryType } from '@/api/entries.js';
import type { Translation } from '@/types.js';
import { runFlow } from './flow.js';
import {
    appendLineToLastEntry,
    appendNewPageToLastEntry,
    appendToLastTranslation,
    captureEntirePage,
    captureFirstLooseLeaf,
    capturePlainTextChapters,
    extractNumericChapters,
    extractRoundNumericChapters,
    flattenChapters,
    processArabicNumericListItem,
    processBulletPoint,
    processChapter,
    processNumericListItem,
    processTranslation,
    trimLine,
} from './flowHandlers.js';

export const mapBookPagesToEntries = (
    pages: Page[],
    isMulti?: boolean,
    {
        captureRoundNumericChapters = true,
        newEntryOnBulletPoints = false,
        flattenAllChapters = false,
        parseNumericChapters = false,
        lineSeparator = '\n',
    } = {},
) => {
    const entries: Partial<Entry>[] = [];

    const discreteHandlers = [captureEntirePage, appendLineToLastEntry];
    const continuousHandlers = [captureFirstLooseLeaf, appendNewPageToLastEntry, appendLineToLastEntry];

    const handlers = [
        trimLine,
        capturePlainTextChapters,
        ...(captureRoundNumericChapters ? [extractRoundNumericChapters] : []),
        ...(flattenAllChapters ? [flattenChapters] : []),
        ...(parseNumericChapters ? [extractNumericChapters] : []),
        processChapter,
        processArabicNumericListItem,
        processNumericListItem,
        ...(newEntryOnBulletPoints ? [processBulletPoint] : []),
        ...(!isMulti ? discreteHandlers : []),
        ...(isMulti ? continuousHandlers : []),
    ];

    for (const page of pages) {
        const rawLines = parseContentRobust(page.content);
        runFlow(rawLines, handlers, entries, page, lineSeparator);
    }

    const idToPages = Object.groupBy(pages, (p) => p.id);

    Object.values(Object.groupBy(entries, (e) => e.from!)).forEach((partialEntries) => {
        let nextIdCounter = 0;

        partialEntries?.forEach((e) => {
            const [page] = idToPages[e.from!]!;

            if (e.type === EntryType.Chapter) {
                e.id = `C${Number(e.id) || page.id}`;
            } else {
                e.id = e.index ? e.index.toString() : `P${page.id}${++nextIdCounter}`;
            }

            if (page.part) {
                e.volume = Number(page.part) || -1; // may be a text value like muqaddimah
            } else {
                e.volume = 1;
            }

            e.pp = page.page;
        });
    });

    return entries;
};

export const mapLinesToTranslations = (content: string) => {
    const lines = content
        .replace(/ (\d+) -/gm, '\n$1 -')
        .replace(/\\\[/gm, '[')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

    const [translations] = runFlow(
        lines,
        [processTranslation, (_line, arr) => !arr.length, appendToLastTranslation],
        [] as Translation[],
    );

    return translations;
};
