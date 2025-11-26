import { normalizeSpaces, removeAllTags } from 'bitaboom';
import { type Line, parseContentRobust } from 'shamela';
import { type Entry, EntryType } from '@/api/entries.js';
import type { MatnParseOptions, ShamelaPage, Translation } from '@/types.js';
import { CAPTURE_CONTINUOUS_PAGES, MARKER_ID_PATTERN, SANITIZE_HTML } from './constants.js';
import { EntriesContext } from './entryContext.js';
import { runFlow } from './flow.js';
import {
    appendLineToLastEntry,
    appendNewPageToLastEntry,
    appendToLastTranslation,
    captureEntirePage,
    captureFirstLooseLeaf,
    captureMarkdownChapters,
    captureNewEntryByPatternOptions,
    captureNumericChapters,
    flattenNumericChapters,
    processChapter,
    processTranslation,
    removeSquareBracketsFromTitles,
    startNewEntryIfLastEntryMatches,
    trimLine,
} from './flowHandlers.js';
import { applyCustomPatches, filterExcludedPages } from './optionsHandler.js';
import { mapPatternsToFormatters } from './textUtils.js';
import { validateDeprecatedOptions } from './validation.js';

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

const assignIdsToSegments = (entries: Partial<Entry>[], idToPages: Partial<Record<number, ShamelaPage[]>>) => {
    const result = Object.values(Object.groupBy(entries, (e) => e.from!)).flatMap((partialEntries) => {
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

            for (const n of next) {
                n.id = `P${page.id}`;
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
        overflow,
        isMarkdown,
        parseNumericChapters,
        replacements = {},
        prevEntryMarkerPattern,
        patternToOptions = {},
        lineSeparator = '\n',
    } = options;

    validateDeprecatedOptions(options);

    if (isMarkdown) {
        options.patternToOptions = { ...options.patternToOptions, '^#': { type: EntryType.Chapter } };
    }

    const discreteHandlers = [captureEntirePage, appendLineToLastEntry];
    const continuousHandlers = [
        captureFirstLooseLeaf,
        ...(overflow === 'punctuation' && prevEntryMarkerPattern
            ? [startNewEntryIfLastEntryMatches(new RegExp(prevEntryMarkerPattern))]
            : []),
        ...(overflow === 'punctuation' ? [appendNewPageToLastEntry] : []),
        appendLineToLastEntry,
    ];
    const sanitizers = getSanitizers([], { replacements });

    const handlers = [
        trimLine,
        removeSquareBracketsFromTitles,
        ...(isMarkdown ? [captureMarkdownChapters] : []),
        ...(parseNumericChapters ? [flattenNumericChapters] : []),
        captureNumericChapters,
        processChapter,
        ...Object.entries(patternToOptions).map(([pattern, options]) =>
            captureNewEntryByPatternOptions(new RegExp(pattern, 'u'), options),
        ),
        ...(!overflow ? discreteHandlers : []),
        ...(overflow ? continuousHandlers : []),
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
    pages = filterExcludedPages(pages, options);
    pages = applyCustomPatches(pages, options);

    let segments = segmentShamelaPages(pages, options);

    segments = assignIdsToSegments(
        segments,
        Object.groupBy(pages, (p) => p.id),
    );

    return segments;
};

export const mapLinesToTranslations = (content: string) => {
    // Pattern to split accidentally merged markers: " P123a -" -> "\nP123a -"
    const mergedMarkerPattern = new RegExp(` (${MARKER_ID_PATTERN} -)`, 'gm');

    const lines = content
        .replace(mergedMarkerPattern, '\n$1')
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
