import { normalizeSpaces } from 'bitaboom';
import { type Line, parseContentRobust } from 'shamela';
import { type Entry, EntryType } from '@/api/entries.js';
import type { ShamelaPage, Translation } from '@/types.js';
import { CAPTURE_CONTINUOUS_PAGES } from './constants.js';
import { fixGaps, validateGaplessEntryIndices } from './entryUtils.js';
import { runFlow } from './flow.js';
import {
    appendLineToLastEntry,
    appendNewPageToLastEntry,
    appendToLastTranslation,
    captureCommaSeparatedArabicNumericListItem,
    captureEntirePage,
    captureFirstLooseLeaf,
    captureNewEntryByPattern,
    captureNumericChapters,
    capturePlainTextChapters,
    captureSquareBracketListItem,
    flattenNumericChapters,
    processArabicLetterNumericListItem,
    processArabicNumericListItem,
    processChapter,
    processNumericListItem,
    processTranslation,
    removeSquareBracketsFromTitles,
    trimLine,
} from './flowHandlers.js';
import { removeAllTags } from './textUtils.js';

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

const assignIdsToEntries = (
    entries: Partial<Entry>[],
    idToPages: Partial<Record<number, ShamelaPage[]>>,
    hasDuplicateNumerals?: boolean,
) => {
    const result = Object.values(Object.groupBy(entries, (e) => e.from!)).flatMap((partialEntries) => {
        let nextIdCounter = 0;

        const values = partialEntries?.flatMap((e) => {
            const [page] = idToPages[e.from!]!;
            const next = [{ ...e, pp: page.pp, volume: page.volume }];

            if (e.type === EntryType.Chapter) {
                next.forEach((n) => {
                    n.id = `C${Number(e.id) || page.id}`;
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

            for (const n of next) {
                if (n.index) {
                    n.id = hasDuplicateNumerals ? `N${n.volume}${n.index}` : `N${n.index}`;
                } else {
                    n.id = `P${page.id}${++nextIdCounter}`;
                }
            }

            return next;
        })!;

        return values;
    });

    return result;
};

const getSanitizers = (patterns: string[], options: { flatten: boolean }) => {
    const sanitizerPipeline = patterns.map((r) => {
        const regex = new RegExp(r, 'g');

        return (text: string) => {
            return text.replace(regex, '');
        };
    });

    if (sanitizerPipeline.length) {
        sanitizerPipeline.push(normalizeSpaces);
    }

    if (options.flatten) {
        sanitizerPipeline.unshift(removeAllTags);
    }

    return sanitizerPipeline;
};

export const mapBookPagesToEntries = (
    pages: ShamelaPage[],
    {
        numeralStrategy = 'dashed',
        flatten = false,
        shouldCapturePlainTextChapters = false,
        parseNumericChapters = false,
        pageSpanning = '',
        newEntryMarkerPattern = '',
        fix = '',
        sanitize = [],
        hasDuplicateNumerals = false,
        captureCommaSeparatedIndices = true,
        lineSeparator = '\n',
    } = {},
) => {
    const isContinuous = Boolean(pageSpanning);

    let entries: Partial<Entry>[] = [];

    const discreteHandlers = [captureEntirePage, appendLineToLastEntry];
    const continuousHandlers = [
        captureFirstLooseLeaf,
        ...(pageSpanning === CAPTURE_CONTINUOUS_PAGES ? [appendNewPageToLastEntry] : []),
        appendLineToLastEntry,
    ];
    const sanitizers = getSanitizers(sanitize, { flatten });

    const handlers = [
        trimLine,
        removeSquareBracketsFromTitles,
        ...(shouldCapturePlainTextChapters ? [capturePlainTextChapters] : []),
        ...(parseNumericChapters ? [flattenNumericChapters] : []),
        captureNumericChapters,
        processChapter,
        ...(numeralStrategy.includes('letter') ? [processArabicLetterNumericListItem] : []),
        ...(numeralStrategy.includes('dashed') ? [processArabicNumericListItem, processNumericListItem] : []),
        ...(numeralStrategy.includes('square') ? [captureSquareBracketListItem] : []),
        ...(captureCommaSeparatedIndices ? [captureCommaSeparatedArabicNumericListItem] : []),
        ...(newEntryMarkerPattern ? [captureNewEntryByPattern(new RegExp(newEntryMarkerPattern, 'u'))] : []),
        ...(!isContinuous ? discreteHandlers : []),
        ...(isContinuous ? continuousHandlers : []),
    ];

    for (const page of pages) {
        const content = sanitizers.reduce((prev, sanitizer) => {
            return sanitizer(prev);
        }, page.content);

        let rawLines = parseContentRobust(content);
        rawLines = splitTextOnCarriageReturns(rawLines);
        runFlow(rawLines, handlers, entries, page, lineSeparator);
    }

    if (fix.includes('indexes')) {
        fixGaps(entries.filter((e) => e.index && !e.type && !e.id) as Entry[]);
        validateGaplessEntryIndices(entries.filter((e) => e.index && !e.type && !e.id) as Entry[]);
    }

    entries = assignIdsToEntries(
        entries,
        Object.groupBy(pages, (p) => p.id),
        hasDuplicateNumerals,
    );

    return entries;
};

export const mapLinesToTranslations = (content: string) => {
    const lines = content
        .replace(/ ([NBCP])(\d+) -/gm, '\n$1$2 -')
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
