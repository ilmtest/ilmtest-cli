import { arabicNumeralToNumber } from 'bitaboom';
import { BookData } from 'shamela';

import { type Entry, EntryType } from '@/api/entries.js';
import { getEntryKey, indexEntriesByNumber } from '@/utils/entryUtils.js';

import type { Translation } from './translationFileParser.js';

import { TYPE_MARKER } from './constants.js';
import logger from './logger.js';
import { parseContentRobust } from './shamelaUtils.js';
import { PATTERNS } from './textUtils.js';

export const applyTranslationsToEntries = (entries: Entry[], translations: Translation[]) => {
    const updatedEntries: Entry[] = [];
    const { indexToEntries, pageToEntries } = indexEntriesByNumber(entries);

    const missing: string[] = [];

    for (const t of translations) {
        if (t.index) {
            const key = getEntryKey(t);

            if (!indexToEntries[key] || indexToEntries[key].length === 0) {
                missing.push(`${t.type ? 'Chapter' : 'Narration'} #${t.index} not found in Arabic pages`);
                continue;
            }

            const { index, type, ...entry } = indexToEntries[key].shift()!;

            updatedEntries.push({
                ...entry,
                ...((!type || type > 0) && { type }),
                translation: t.translation,
                translator: t.translator,
                ...(!t.type && index && { index }),
            });
        } else if (t.from) {
            if (!pageToEntries[t.from] || pageToEntries[t.from].length === 0) {
                console.error(`Loose entry at page ${t.from} not found in Arabic pages ${t}`);
                return [];
            }

            const entry = pageToEntries[t.from].shift()!;

            updatedEntries.push({
                ...entry,
                translation: t.translation,
                translator: t.translator,
            });
        } else {
            console.error(`Unknown translation: `, t);
            return [];
        }
    }

    if (missing.length) {
        console.error(missing);
        return [];
    }

    return updatedEntries;
};

type MapBookPagesToEntriesOptions = {
    markerPattern?: RegExp;
    max: number;
};

export const mapBookPagesToEntries = (book: BookData, options: MapBookPagesToEntriesOptions) => {
    const entries: Partial<Entry>[] = [];

    for (const page of book.pages) {
        logger.trace(`page ${page.id}.content: ${page.content}`);
        const lines = parseContentRobust(page.content);

        logger.trace(`lines: ${JSON.stringify(lines, null, 2)}`);

        const entry = {
            from: page.id,
            ...(page.page && { pp: page.page }),
            volume: page.part!,
        };

        let nextMarkerId = 0;

        for (const line of lines) {
            if (line.id) {
                entries.push({
                    ...entry,
                    arabic: line.text.trim(),
                    index: Number(line.id),
                    type: EntryType.Chapter,
                });

                continue;
            }

            const [, index, text] =
                line.text.match(PATTERNS.MatchArabicNumericListItem) ||
                line.text.match(PATTERNS.MatchNumericListItem) ||
                [];

            if (index && text) {
                const romanNumber = arabicNumeralToNumber(index);

                entries.push({
                    ...entry,
                    arabic: text.trim(),
                    index: romanNumber,
                });

                continue;
            }

            const arabic = line.text.trim();

            if (options.markerPattern) {
                const [, matchedText] = arabic.match(options.markerPattern) || [];

                if (matchedText) {
                    entries.push({
                        ...entry,
                        arabic: matchedText,
                        index: parseInt(`${page.id}${++nextMarkerId}`),
                        type: TYPE_MARKER as EntryType,
                    });
                    continue;
                }
            }

            if (!entries.length) {
                continue;
            }

            const lastEntry = entries.at(-1)!;
            const diff = page.id - lastEntry.from!;

            if (diff >= options.max) {
                entries.push({
                    ...entry,
                    arabic,
                });

                continue;
            }

            lastEntry.arabic += '\n' + arabic;

            if (diff) {
                lastEntry.to = page.id;
            }
        }
    }

    return entries;
};
