import type { Page } from 'shamela';

import { type Entry, EntryType } from '@/api/entries.js';
import type { Translation } from '@/types.js';
import { runFlow } from './flow.js';
import {
    appendToLastEntry,
    appendToLastTranslation,
    capturePlainTextChapters,
    captureTrailingEntry,
    extractNumericChapters,
    extractRoundNumericChapters,
    processArabicNumericListItem,
    processChapter,
    processNumericListItem,
    processTranslation,
    trimLine,
} from './flowHandlers.js';
import { parseContentRobust } from './shamelaUtils.js';

export const mapBookPagesToEntries = (
    pages: Page[],
    options: {
        maxPagesPerEntry: number;
    },
) => {
    const entries: Partial<Entry>[] = [];

    for (const page of pages) {
        const rawLines = parseContentRobust(page.content);

        runFlow(
            rawLines,
            [
                trimLine,
                capturePlainTextChapters,
                extractRoundNumericChapters,
                extractNumericChapters,
                processChapter,
                processArabicNumericListItem,
                processNumericListItem,
                () => entries.length === 0,
                captureTrailingEntry,
                appendToLastEntry,
            ],
            entries,
            page,
            options.maxPagesPerEntry,
        );
    }

    const idToPages = Object.groupBy(pages, (p) => p.id);

    Object.values(Object.groupBy(entries, (e) => e.from!)).forEach((partialEntries) => {
        let nextIdCounter = 0;

        partialEntries?.forEach((e) => {
            const [page] = idToPages[e.from!]!;

            if (e.type === EntryType.Chapter) {
                e.id = `C${Number(e.id) || page.id /*++nextIdCounter*/}`;
            } else {
                e.id = e.index ? e.index.toString() : `P${page.id}${++nextIdCounter}`;
            }

            e.volume = page.part;
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
