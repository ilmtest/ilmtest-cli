import { normalizeSpaces, removeAllTags } from 'bitaboom';
import { generateRegexFromMarker } from 'flappa-doormal';
import { type Line, parseContentRobust } from 'shamela';
import { type Entry, EntryType } from '@/api/entries.js';
import type { MatnParseOptions, ShamelaPage, Translation } from '@/types.js';
import { MARKER_ID_PATTERN, SANITIZE_HTML } from './constants.js';
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
import { validateDeprecatedOptions, validateParseOptions } from './validation.js';

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

/**
 * Extracts marker-based segments from full page content.
 * This runs BEFORE parseContentRobust to capture multi-line entries.
 *
 * Strategy: Collect markers from ALL patterns, sort by position, split content.
 * This handles pages with multiple marker types (e.g., plain numbered + bullet-prefixed).
 *
 * @param content - Full page content with newlines preserved
 * @param patternToOptions - Map of regex patterns to their options
 * @param page - Current page being processed
 * @returns Array of matched segments with their metadata
 */
const extractMarkerSegments = (content: string, patternToOptions: Record<string, any>, page: ShamelaPage) => {
    // Step 1: Collect all marker matches from ALL patterns
    const allMarkers: Array<{
        index: number;
        markerLength: number;
        markerText: string;
        options: any;
    }> = [];

    for (const [pattern, options] of Object.entries(patternToOptions)) {
        if (options.minPage && page.id < options.minPage) {
            continue;
        }

        // Skip if pattern doesn't have flappa-doormal structure (named groups)
        if (!pattern.includes('(?<marker>') || !pattern.includes('(?<content>')) {
            // This is a legacy pattern - skip marker extraction
            continue;
        }

        // Extract ONLY the marker pattern (strip content group which is greedy)
        // This allows us to find ALL marker positions without greedy content consuming subsequent markers
        const markerOnlyPattern = pattern.replace(/\(\?<content>[\s\S]*?\)/g, '');
        const regex = new RegExp(markerOnlyPattern, 'ugm');

        for (const match of content.matchAll(regex)) {
            if (match.groups?.marker) {
                allMarkers.push({
                    index: match.index!,
                    markerLength: match.groups.marker.length,
                    markerText: match.groups.marker,
                    options,
                });
            }
        }
    }

    // If no markers found, return empty
    if (allMarkers.length === 0) {
        return [];
    }

    // Step 2: Deduplicate markers at same position - keep the longest (most specific)
    const markersByPosition = new Map<number, (typeof allMarkers)[0]>();

    for (const marker of allMarkers) {
        const existing = markersByPosition.get(marker.index);
        if (!existing || marker.markerLength > existing.markerLength) {
            // Keep this marker if it's longer than existing one at this position
            markersByPosition.set(marker.index, marker);
        }
    }

    // Convert back to array and sort by position
    const uniqueMarkers = Array.from(markersByPosition.values()).sort((a, b) => a.index - b.index);

    // Step 3: Split content between consecutive markers and convert to Line objects
    // The flow handlers will process these lines (including extracting spans)
    const lines: Line[] = [];

    // Handle content BEFORE the first marker (cross-page continuation)
    // If page starts with non-marker text, it's likely a continuation from previous page
    if (uniqueMarkers.length > 0 && uniqueMarkers[0].index > 0) {
        const prefixText = content.slice(0, uniqueMarkers[0].index);
        const prefixLines = parseContentRobust(prefixText);
        lines.push(...prefixLines);
    }

    for (let i = 0; i < uniqueMarkers.length; i++) {
        const current = uniqueMarkers[i];
        const next = uniqueMarkers[i + 1];

        const startIdx = current.index;
        const endIdx = next ? next.index : content.length;

        const fullText = content.slice(startIdx, endIdx);

        // Parse this segment to extract lines (including spans with ids)
        const segmentLines = parseContentRobust(fullText);

        // Add all lines from this segment
        lines.push(...segmentLines);
    }

    return lines;
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
    validateParseOptions(options);

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

        const markerLines = extractMarkerSegments(content, patternToOptions, page);

        if (markerLines.length > 0) {
            // Found marker-based lines - process them through existing flow handlers
            // This allows processChapter, etc. to handle spans and other logic
            const processedLines = splitTextOnCarriageReturns(markerLines);
            runFlow(processedLines, handlers, page, context);
        } else {
            // No markers found - use existing line-by-line flow
            // This handles: cross-page continuation, titles, unmarked pages
            let rawLines = parseContentRobust(content);
            rawLines = splitTextOnCarriageReturns(rawLines);
            runFlow(rawLines, handlers, page, context);
        }
    }

    return context.result;
};

export const segmentPages = (pages: ShamelaPage[], options: MatnParseOptions = {}) => {
    const { markers = [], excludePatterns = [] } = options;

    // Process new markers config for patternToOptions
    markers.forEach((marker) => {
        // Apply default entryType from metadata or for 'bab' markers
        const entryType = marker.metadata?.type ?? (marker.type === 'bab' ? 2 : 0);

        const regex = generateRegexFromMarker(marker);
        options.patternToOptions = {
            ...options.patternToOptions,
            [regex.source]: {
                minPage: marker.minPage,
                type: entryType,
                ...(marker.metadata || {}),
            },
        };
    });

    // Process new exclude patterns
    if (excludePatterns.length) {
        options.excludePagesWithPatterns = [...(options.excludePagesWithPatterns || []), ...excludePatterns];
    }

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
