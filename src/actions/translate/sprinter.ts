import { reduceMultilineBreaksToSingle } from 'bitaboom';

import { Entry } from '@/api/entries.js';

import type { Page } from '../../api/maktabah.js';

import { createBaseEntryFromPage } from './mapping.js';
import { PATTERNS } from './patterns.js';

export const sprintAndMapPagesByLines = (pages: Page[]) => {
    const entries: Entry[] = [];
    let lastIndex = '';

    for (const page of pages) {
        const lines = page.body
            .split('\n')
            .filter((l) => l.trim())
            .filter(Boolean);

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            const [, index, text] = line.match(PATTERNS.MatchNumericListItem) || [];

            if (index && text) {
                entries.push(createBaseEntryFromPage(page, text, index));
                lastIndex = i === lines.length - 1 && !line.endsWith('.') ? index : '';
                //lastIndex = index;
            } else if (lastIndex) {
                const lastEntry = entries.at(-1)!;

                if (lastEntry.from !== page.page) {
                    lastEntry.to = page.page;
                }

                lastEntry.arabic += ' ' + line;
                /*
                if (entries.at(-1)!.arabic?.endsWith('.')) {
                    entries.at(-1)!.arabic += '\n' + line;
                } else {
                    entries.at(-1)!.arabic += ' ' + line;
                } */

                lastIndex = !line.endsWith('.') ? index : '';
            }
        }
    }

    return entries;
};

export const sprintAndMapPages = (pages: Page[]) => {
    const entries: Entry[] = [];

    for (const page of pages) {
        const [, index, text] = page.body.match(/^(\d+)\s?[-–—ـ]([\s\S]*)$/m) || [];

        if (index) {
            entries.push(createBaseEntryFromPage(page, reduceMultilineBreaksToSingle(text), index));
        }
    }

    return entries;
};

export const sprintAndMapPagesByParagraphs = (pages: Page[]) => {
    const entries: Entry[] = [];

    for (const page of pages) {
        const matches = [...page.body.matchAll(PATTERNS.MatchNumberedParagraph)];

        for (const [, index, text] of matches) {
            if (index) {
                entries.push(createBaseEntryFromPage(page, reduceMultilineBreaksToSingle(text), index));
            }
        }
    }

    return entries;
};

export const applyTranslationsToEntries = (entries: Entry[], translation: string[]) => {
    const indexToEntry: Record<string, Entry[]> = {};
    const updatedEntries: Entry[] = [];

    for (const entry of entries) {
        indexToEntry[entry.index!] = (indexToEntry[entry.index!] || []).concat(entry);
    }

    let lastIndex = '';

    for (const line of translation) {
        const [, index, text] = line.match(PATTERNS.MatchNumericListItem) || [];

        if (index && text) {
            if (!indexToEntry[index]) {
                console.error(`#${index} not found in Arabic pages`);
                return [];
            }

            const entry = indexToEntry[index].shift()!;
            updatedEntries.push({ ...entry, translation: text.trim() });
            lastIndex = index;
        } else if (lastIndex) {
            updatedEntries.at(-1)!.translation = [updatedEntries.at(-1)!.translation, line.trim()].join('\n').trim();
        }
    }

    return updatedEntries;
};
