import { arabicNumeralToNumber, isAllUppercase, toTitleCase } from 'bitaboom';
import type { BookData } from 'shamela';

import { type Entry, EntryType } from '@/api/entries.js';
import { getEntryKey, indexEntriesByNumber } from '@/utils/entryUtils.js';
import { TYPE_MARKER } from './constants.js';
import logger from './logger.js';
import { type FlowHandler, runFlow } from './pipeline.js';
import { type Line, parseContentRobust } from './shamelaUtils.js';
import { PATTERNS } from './textUtils.js';

export type Translation = Pick<Entry, 'index' | 'translation' | 'translator' | 'type'> & Pick<Partial<Entry>, 'from'>;

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
    maxPagesPerEntry: number;
};

export const mapBookPagesToEntries = (book: BookData, options: MapBookPagesToEntriesOptions) => {
    const entries: Partial<Entry>[] = [];

    for (const page of book.pages) {
        logger.trace(`page ${page.id}.content: ${page.content}`);
        const rawLines = parseContentRobust(page.content);
        logger.trace(`lines: ${JSON.stringify(rawLines, null, 2)}`);

        const base = {
            from: page.id,
            ...(page.page && { pp: page.page }),
            volume: page.part!,
        };

        let nextMarkerId = 0;

        const handlers: FlowHandler<Line>[] = [
            // 0) Trim text (pure transform → always continue)
            (ln) => ({ id: ln.id, text: ln.text.trim() }),

            // 1) Chapter line with embedded numeric → drop id so numeric handlers catch it
            (ln) => {
                if (ln.id && PATTERNS.MatchArabicNumericListItem.test(ln.text)) {
                    return { text: ln.text };
                }

                return ln;
            },

            // 2) Plain chapter (id still present)
            (ln) => {
                if (ln.id) {
                    entries.push({
                        ...base,
                        arabic: ln.text,
                        index: Number(ln.id),
                        type: EntryType.Chapter,
                    });

                    return;
                }

                return ln; // handled → stop chain for this line
            },

            // 3) Arabic numerals
            (ln) => {
                const m = ln.text.match(PATTERNS.MatchArabicNumericListItem);
                if (!m) {
                    return ln;
                }
                const [, idx, txt] = m;
                entries.push({ ...base, arabic: txt.trim(), index: arabicNumeralToNumber(idx) });
                return; // handled
            },

            // 4) Latin numerals
            (ln) => {
                const m = ln.text.match(PATTERNS.MatchNumericListItem);
                if (!m) {
                    return ln;
                }
                const [, idx, txt] = m;
                entries.push({ ...base, arabic: txt.trim(), index: parseInt(idx, 10) });
                return; // handled
            },

            // 5) Optional markers
            (ln) => {
                const [, matchedText] = (options.markerPattern && ln.text.match(options.markerPattern)) || [];

                if (!matchedText) {
                    return ln;
                }

                entries.push({
                    ...base,
                    arabic: matchedText,
                    index: parseInt(`${page.id}${++nextMarkerId}`, 10),
                    type: TYPE_MARKER as EntryType,
                });
                return; // handled
            },

            (ln) => {
                if (entries.length) {
                    return ln; // only move on if we have at least 1 element we processed
                }
            },
            ({ text: arabic }) => {
                const last = entries.at(-1)!;
                const diff = page.id - last.from!;

                if (diff >= options.maxPagesPerEntry) {
                    entries.push({ ...base, arabic });
                } else {
                    last.arabic = [last.arabic, arabic].filter(Boolean).join('\n');

                    if (diff > 0) {
                        last.to = page.id;
                    }
                }

                return undefined; // handled
            },
        ];

        runFlow(rawLines, handlers);
    }

    return entries;
};

export const mapLinesToTranslations = (lines: string[]) => {
    const translations: Translation[] = [];

    const handlers: FlowHandler<string>[] = [
        (line) => {
            const [, idx, txt] = line.match(/^C(\d+)\s?[-–—ـ](.*)$/) || [];

            if (!txt) {
                return line;
            }

            translations.push({
                index: parseInt(idx, 10),
                translation: isAllUppercase(txt) ? toTitleCase(txt) : txt,
                type: EntryType.Chapter,
            });
        },
        (line) => {
            const [, idx, txt] = line.match(/^M(\d+)\s?[-–—ـ](.*)$/) || [];

            if (!txt) {
                return line;
            }

            translations.push({
                index: parseInt(idx, 10),
                translation: txt,
                type: TYPE_MARKER as EntryType,
            });
        },

        // P#: page-bounded start
        (line) => {
            const [, idx, txt] = line.match(/^P(\d+)\s?[-–—ـ](.*)$/) || [];

            if (!txt) {
                return line;
            }

            translations.push({ from: parseInt(idx, 10), translation: txt });
            return undefined;
        },

        // Plain numbered items
        (line) => {
            const [, idx, txt] = line.match(PATTERNS.MatchNumericListItem) || [];

            if (!txt) {
                return line;
            }

            translations.push({ index: parseInt(idx, 10), translation: txt });
            return undefined;
        },

        // Fallback: append to last translation
        (line) => {
            const last = translations.at(-1);

            if (last) {
                last.translation = [last.translation, line].join('\n');
            }

            return undefined; // handled
        },
    ];

    runFlow(lines, handlers);

    return translations;
};
