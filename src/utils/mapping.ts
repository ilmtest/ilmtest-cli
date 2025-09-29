import { type Line, type Page, parseContentRobust } from 'shamela';

import { type Entry, EntryType } from '@/api/entries.js';
import type { ShamelaPage, Translation } from '@/types.js';
import { runFlow } from './flow.js';
import {
    appendLineToLastEntry,
    appendNewPageToLastEntry,
    appendToLastTranslation,
    captureEntirePage,
    captureFirstLooseLeaf,
    captureNumericChapters,
    capturePlainTextChapters,
    extractRoundNumericChapters,
    flattenChapters,
    flattenNumericChapters,
    processArabicLetterNumericListItem,
    processArabicNumericListItem,
    processBulletPoint,
    processChapter,
    processNumericListItem,
    processTranslation,
    removeSquareBracketsFromTitles,
    trimLine,
} from './flowHandlers.js';

const splitTextOnCarriageReturns = (items: Line[]) => {
    const result: Line[] = [];

    for (const item of items) {
        // Check if the text contains carriage returns
        if (item.text.includes('\r')) {
            // Split on carriage returns and filter out empty strings
            const parts = item.text.split('\r').filter((part) => part.trim() !== '');

            if (parts.length > 0) {
                // First part keeps the id (if it exists)
                result.push({
                    ...(item.id && { id: item.id }),
                    text: parts[0].trim(),
                });

                // Remaining parts become separate text-only elements
                for (let i = 1; i < parts.length; i++) {
                    result.push({
                        text: parts[i].trim(),
                    });
                }
            }
        } else {
            // No carriage returns, keep the item as is
            result.push(item);
        }
    }

    return result;
};

export const mapBookPagesToEntries = (
    pages: ShamelaPage[],
    {
        captureRoundNumericChapters = false,
        captureNumbered = true,
        newEntryOnBulletPoints = false,
        flattenAllChapters = false,
        parseNumericChapters = false,
        isContinuous = false,
        captureTrailing = false,
        lineSeparator = '\n',
    } = {},
) => {
    const entries: Partial<Entry>[] = [];

    const discreteHandlers = [captureEntirePage, appendLineToLastEntry];
    const continuousHandlers = [
        captureFirstLooseLeaf,
        ...(captureTrailing ? [appendNewPageToLastEntry] : []),
        appendLineToLastEntry,
    ];

    const handlers = [
        trimLine,
        removeSquareBracketsFromTitles,
        capturePlainTextChapters,
        ...(captureRoundNumericChapters ? [extractRoundNumericChapters] : []),
        ...(flattenAllChapters ? [flattenChapters] : []),
        ...(parseNumericChapters ? [flattenNumericChapters] : []),
        captureNumericChapters,
        processArabicLetterNumericListItem,
        processChapter,
        ...(captureNumbered ? [processArabicNumericListItem] : []),
        processNumericListItem,
        ...(newEntryOnBulletPoints ? [processBulletPoint] : []),
        ...(!isContinuous ? discreteHandlers : []),
        ...(isContinuous ? continuousHandlers : []),
    ];

    for (const page of pages) {
        let rawLines = parseContentRobust(page.content);
        rawLines = splitTextOnCarriageReturns(rawLines);
        runFlow(rawLines, handlers, entries, page, lineSeparator);
    }

    const idToPages = Object.groupBy(pages, (p) => p.id);

    Object.values(Object.groupBy(entries, (e) => e.from!)).forEach((partialEntries) => {
        let nextIdCounter = 0;

        partialEntries?.forEach((e) => {
            const [page] = idToPages[e.from!]!;

            if (e.type === EntryType.Chapter) {
                e.id = `C${Number(e.id) || page.id}`;
            } else if (e.type === EntryType.Book) {
                e.id = `B${Number(e.id) || page.id}`;
            } else {
                e.id = e.index ? `N${e.index}` : `P${page.id}${++nextIdCounter}`;
            }

            e.volume = page.volume;
            e.pp = page.pp;
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
