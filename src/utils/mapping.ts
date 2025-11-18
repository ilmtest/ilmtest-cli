import { normalizeSpaces, removeAllTags } from 'bitaboom';
import { type Line, parseContentRobust } from 'shamela';
import { type Entry, EntryType } from '@/api/entries.js';
import type { MatnParseOptions, ShamelaPage, Translation } from '@/types.js';
import { CAPTURE_CONTINUOUS_PAGES, SANITIZE_HTML } from './constants.js';
import { EntriesContext } from './entryContext.js';
import { fixGaps, fixGapsLegacy, validateGaplessEntryIndices } from './entryUtils.js';
import { runFlow } from './flow.js';
import {
    appendLineToLastEntry,
    appendNewPageToLastEntry,
    appendToLastTranslation,
    captureCommaSeparatedArabicNumericListItem,
    captureEntirePage,
    captureFirstLooseLeaf,
    captureMarkdownChapters,
    captureNewEntryByPattern,
    captureNewEntryByPatternAndType,
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
    startNewEntryIfLastEntryMatches,
    trimLine,
    usedTerms,
} from './flowHandlers.js';
import { mapPatternsToFormatters } from './textUtils.js';

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

const assignIdsToSegments = (
    entries: Partial<Entry>[],
    idToPages: Partial<Record<number, ShamelaPage[]>>,
    hasDuplicateNumerals?: boolean,
) => {
    const result = Object.values(Object.groupBy(entries, (e) => e.from!)).flatMap((partialEntries) => {
        const nextIdCounter = 0;

        const values = (partialEntries || []).flatMap((e) => {
            const [page] = idToPages[e.from!]!;
            const next = [{ ...e, pp: page.pp, volume: page.volume }] as Entry[];

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
                    //n.id = `P${page.id}${++nextIdCounter}`;
                    n.id = `P${page.id}`;
                }
            }

            return next;
        })!;

        return values;
    });

    return result;
};

const getSanitizers = (patterns: string[], options: { flatten?: boolean; replacements: Record<string, string> }) => {
    let sanitizerPipeline = patterns
        .filter((r) => r !== SANITIZE_HTML)
        .map((r) => {
            const regex = new RegExp(r, 'g');

            return (text: string) => {
                return text.replace(regex, '');
            };
        });

    sanitizerPipeline = sanitizerPipeline.concat(mapPatternsToFormatters(options.replacements));

    if (sanitizerPipeline.length) {
        sanitizerPipeline.push(normalizeSpaces);
    }

    if (options.flatten || patterns.includes(SANITIZE_HTML)) {
        sanitizerPipeline.unshift(removeAllTags);
    }

    return sanitizerPipeline;
};

const segmentShamelaPages = (pages: ShamelaPage[], options: MatnParseOptions) => {
    const {
        pageSpanning,
        sanitize,
        flatten,
        isMarkdown,
        shouldCapturePlainTextChapters,
        parseNumericChapters,
        numeralStrategy = 'dashed',
        firstPageWithIndex = 1,
        captureCommaSeparatedIndices,
        replacements = {},
        patternToType = {},
        lineSeparator = '\n',
        prevEntryMarkerPattern,
        newEntryMarkerPattern,
    } = options;

    const isContinuous = Boolean(pageSpanning);

    const discreteHandlers = [captureEntirePage, appendLineToLastEntry];
    const continuousHandlers = [
        captureFirstLooseLeaf,
        ...(pageSpanning === CAPTURE_CONTINUOUS_PAGES && prevEntryMarkerPattern
            ? [startNewEntryIfLastEntryMatches(new RegExp(prevEntryMarkerPattern))]
            : []),
        ...(pageSpanning === CAPTURE_CONTINUOUS_PAGES ? [appendNewPageToLastEntry] : []),
        appendLineToLastEntry,
    ];
    const sanitizers = getSanitizers(sanitize || [], { flatten, replacements });

    const handlers = [
        trimLine,
        removeSquareBracketsFromTitles,
        ...(isMarkdown ? [captureMarkdownChapters] : []),
        ...(shouldCapturePlainTextChapters ? [capturePlainTextChapters] : []),
        ...(parseNumericChapters ? [flattenNumericChapters] : []),
        captureNumericChapters,
        processChapter,
        ...(numeralStrategy.includes('letter') ? [processArabicLetterNumericListItem] : []),
        ...(numeralStrategy.includes('dashed')
            ? [processArabicNumericListItem(firstPageWithIndex), processNumericListItem]
            : []),
        ...(numeralStrategy.includes('square') ? [captureSquareBracketListItem] : []),
        ...(captureCommaSeparatedIndices ? [captureCommaSeparatedArabicNumericListItem] : []),
        ...(newEntryMarkerPattern ? [captureNewEntryByPattern(new RegExp(newEntryMarkerPattern, 'u'))] : []),
        ...Object.entries(patternToType).map(([pattern, type]) =>
            captureNewEntryByPatternAndType(new RegExp(pattern, 'u'), type),
        ),
        ...(!isContinuous ? discreteHandlers : []),
        ...(isContinuous ? continuousHandlers : []),
    ];

    const context = new EntriesContext(lineSeparator);

    for (const page of pages) {
        const content = sanitizers.reduce((prev, sanitizer) => {
            return sanitizer(prev);
        }, page.content);

        let rawLines = parseContentRobust(content);
        rawLines = splitTextOnCarriageReturns(rawLines);
        runFlow(rawLines, handlers, page, context);
    }

    return context.result;
};

export const segmentPages = (pages: ShamelaPage[], options: MatnParseOptions = {}) => {
    let segments = segmentShamelaPages(pages, options);

    if (options.fix?.includes('unstable_indexes')) {
        segments = fixGaps(segments);
    }

    if (options.fix?.includes('indexes')) {
        fixGapsLegacy(segments as any);
        validateGaplessEntryIndices(segments.filter((e) => e.index && !e.type && !e.id) as Entry[]);
    }

    segments = assignIdsToSegments(
        segments,
        Object.groupBy(pages, (p) => p.id),
        options.hasDuplicateNumerals,
    );

    return segments;
};

export const mapLinesToTranslations = (content: string) => {
    const lines = content
        .replace(/ ([NBCP]\d+[a-j]?) -/gm, '\n$1$2 -')
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
