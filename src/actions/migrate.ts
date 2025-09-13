import { confirm } from '@inquirer/prompts';
import { stripHtml } from 'string-strip-html';
import type { Entry } from '@/api/entries.js';
import { findMatches } from '@/utils/fuzzy.js';
import logger from '@/utils/logger.js';
import { mapBookPagesToEntries } from '@/utils/mapping.js';
import { loadData, type ShamelaBook } from './shamela.js';

import { saveEntries } from './uploadTranslations.js';

const createPatch = (originalEntry: Entry, newPage: Pick<Entry, 'from' | 'pp' | 'volume'>) => {
    return {
        from: newPage.from,
        id: originalEntry.id,
        pp: newPage.pp,
        ...(newPage.volume && { volume: newPage.volume }),
        ...(originalEntry.to && { to: newPage.from + 1 }),
    };
};

const matchEntriesBySegments = (book: ShamelaBook, entries: Entry[], maxPagesPerEntry: number) => {
    const patches: Partial<Entry>[] = [];

    const arabicEntries = mapBookPagesToEntries(book, { maxPagesPerEntry });

    const unlinked = findMatches(
        arabicEntries.map((a) => a.arabic!),
        entries.map((e) => e.arabic!),
    )
        .map((m, i) => {
            const entry = entries[i];

            if (m === -1) {
                return entry;
            } else {
                patches.push(createPatch(entries[i], arabicEntries[m] as any));
            }
        })
        .filter(Boolean) as Partial<Entry>[];

    return { patches, unlinked };
};

const matchEntriesByPages = (book: ShamelaBook, entries: Partial<Entry>[]) => {
    const patches: Partial<Entry>[] = [];

    const unlinked = findMatches(
        book.pages.map((p) => [stripHtml(p.content).result, p.footer].filter(Boolean).join('\n')),
        entries.map((e) => e.arabic!),
    )
        .map((m, i) => {
            if (m === -1) {
                return entries[i];
            }

            const page = book.pages[m];
            patches.push(createPatch(entries[i] as Entry, { from: page.id, pp: page.page!, volume: page.part! }));
        })
        .filter(Boolean) as Partial<Entry>[];

    return { patches, unlinked };
};

export const migrateEntries = async () => {
    process.argv = process.argv.filter((s) => s !== '--migrate');

    const { book, entries, max } = await loadData({ loadFullEntries: true });

    logger.info(`${entries.length} entries to link...`);

    let { patches, unlinked } = matchEntriesBySegments(book, entries, max);

    logger.info(`${patches.length} entries linked, ${unlinked.length} could not be linked...`);

    // second pass: try to match with the entire book
    const result = matchEntriesByPages(book, unlinked);
    patches = patches.concat(result.patches);

    unlinked = result.unlinked;

    logger.info(`${patches.length} entries linked, ${unlinked.length} could not be linked...`);

    unlinked.forEach((u) => {
        patches.unshift(createPatch(u as Entry, { from: null, pp: null, volume: null } as any));
    });

    const confirmed = await confirm({
        message: `Do you want to commit these changes ${JSON.stringify(patches, null, 2)}?`,
    });

    if (confirmed) {
        await saveEntries(patches as Entry[], logger.level === 'debug');
    }
};
