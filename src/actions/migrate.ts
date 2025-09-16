import { confirm } from '@inquirer/prompts';
import { findMatches } from 'baburchi';
import { stripHtml } from 'string-strip-html';
import type { Entry } from '@/api/entries.js';
import { getEntryKey, indexEntriesByNumber } from '@/utils/entryUtils.js';
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

const matchEntriesBySegments = (book: ShamelaBook, entries: Entry[]) => {
    const patches: Partial<Entry>[] = [];

    const arabicEntries = mapBookPagesToEntries(book.pages, { maxPagesPerEntry: 1 });

    const unlinked = findMatches(
        arabicEntries.map((a) => a.arabic!),
        entries.map((e) => e.arabic!),
    )
        .map((m, i) => {
            const entry = entries[i];

            if (m === -1) {
                return entry;
            }

            const page = arabicEntries[m];

            if (page.from !== entry.from || page.pp !== entry.pp || page.volume !== entry.volume) {
                patches.push(createPatch(entry, page as any));
            }

            return false;
        })
        .filter(Boolean) as Entry[];

    return { ...indexEntriesByNumber(arabicEntries as Entry[]), patches, unlinked };
};

const matchEntriesByPages = (book: ShamelaBook, entries: Entry[]) => {
    const patches: Partial<Entry>[] = [];
    const pages = book.pages.map((p) => [stripHtml(p.content).result, p.footer].filter(Boolean).join('\n'));
    const excerpts = entries.map((e) => e.arabic!);

    const unlinked = findMatches(pages, excerpts)
        .map((m, i) => {
            const entry = entries[i];

            if (m === -1) {
                return entry;
            }

            const { page: pp, id: from, part: volume } = book.pages[m];

            if (from !== entry.from || volume !== entry.volume || pp !== entry.pp) {
                patches.push(createPatch(entry, { from, pp: pp!, volume: volume! }));
            }

            return false;
        })
        .filter(Boolean) as Entry[];

    return { patches, unlinked };
};

export const migrateEntries = async () => {
    process.argv = process.argv.filter((s) => s !== '--migrate');

    const { book, entries } = await loadData();

    logger.info(`${entries.length} entries to link...`);

    let { patches, unlinked, indexToEntries, pageToEntries } = matchEntriesBySegments(book, entries);

    logger.info(`${patches.length} entries linked, ${unlinked.length} could not be linked...`);

    if (unlinked.length) {
        // second pass: try to match with the entire book
        const result = matchEntriesByPages(book, unlinked);
        patches = patches.concat(result.patches);

        unlinked = result.unlinked;

        logger.info(`${patches.length} entries linked, ${unlinked.length} could not be linked...`);
    }

    let confirmed = false;

    if (unlinked.length) {
        confirmed = await confirm({
            message: `Do you want to link these using indexes?`,
        });

        const remaining: Entry[] = [];

        unlinked.forEach((entry) => {
            const key = getEntryKey(entry);
            const page = indexToEntries[key]?.shift();
            console.log('looking for', key, indexToEntries[key]);

            if (page && (page.from !== entry.from || page.pp !== entry.pp || page.volume !== entry.volume)) {
                patches.push(createPatch(entry, page as any));
            } else {
                remaining.push(entry);
            }
        });

        unlinked = remaining;

        logger.info(`${patches.length} entries linked, ${unlinked.length} could not be linked...`);
    }

    unlinked.forEach((u) => {
        patches.unshift(createPatch(u as Entry, { from: null, pp: null, volume: null } as any));
    });

    confirmed = await confirm({
        message: `Do you want to commit these changes ${JSON.stringify(
            patches.filter((p) => !p.from),
            null,
            2,
        )}?`,
    });

    if (confirmed) {
        await saveEntries(patches as Entry[], logger.level === 'debug');
    }
};
