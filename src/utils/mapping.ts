import { type Line, type Page, parseContentRobust } from 'shamela';

import { type Entry, EntryType } from '@/api/entries.js';
import type { ShamelaPage, Translation } from '@/types.js';
import { runFlow } from './flow.js';
import {
    appendLineToLastEntry,
    appendNewPageToLastEntry,
    appendToLastTranslation,
    captureCommaSeparatedArabicNumericListItem,
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
        captureCommaSeparatedIndices = true,
        lineSeparator = '\n',
    } = {},
) => {
    let entries: Partial<Entry>[] = [];

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
        ...(captureCommaSeparatedIndices ? [captureCommaSeparatedArabicNumericListItem] : []),
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

    entries = Object.values(Object.groupBy(entries, (e) => e.from!)).flatMap((partialEntries) => {
        let nextIdCounter = 0;

        const values = partialEntries?.flatMap((e) => {
            const [page] = idToPages[e.from!]!;
            const next = [{ ...e, pp: page.pp, volume: page.volume }];

            if (e.type === EntryType.Chapter) {
                next.forEach((n) => {
                    n.id = `C${Number(n.id) || page.id}`;
                });

                return next;
            }

            if (e.type === EntryType.Book) {
                next.forEach((n) => {
                    n.id = `B${Number(n.id) || page.id}`;
                });

                return next;
            }

            if (e.id?.includes(',')) {
                // comma separated
                const [index, ...indexes] = e.id.split(',');
                next[0].index = Number(index);

                for (const i of indexes) {
                    next.push({ ...next[0], arabic: '', index: Number(i) });
                }
            }

            next.forEach((n) => {
                n.id = n.index ? `N${n.index}` : `P${page.id}${++nextIdCounter}`;
            });

            return next;
        })!;

        return values;
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
