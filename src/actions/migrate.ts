import { confirm } from '@inquirer/prompts';
import { findMatches } from 'baburchi';
import { stripHtml } from 'string-strip-html';
import type { Entry } from '@/api/entries.js';
import type { ShamelaBook } from '@/types.js';
import { getEntryKey, indexEntriesForLookup } from '@/utils/entryUtils.js';
import logger from '@/utils/logger.js';
import { mapBookPagesToEntries } from '@/utils/mapping.js';
import { loadData } from './shamela.js';
import { saveEntries } from './uploadTranslations.js';

/**
 * Creates a patch object for updating entry page information
 * @param originalEntry - The original entry to be updated
 * @param newPage - New page information containing from, pp, and volume data
 * @returns Partial entry object with updated page information
 */
const createPatch = (originalEntry: Entry, newPage: Pick<Entry, 'from' | 'pp' | 'volume'>) => {
    return {
        from: newPage.from,
        id: originalEntry.id,
        pp: newPage.pp,
        ...(newPage.volume && { volume: newPage.volume }),
        ...(originalEntry.to && { to: newPage.from + 1 }),
    };
};

/**
 * Matches entries with book segments using fuzzy matching algorithms
 * @param book - The Shamela book data to match against
 * @param entries - Array of entries to be matched
 * @param isMulti - Whether the book has multiple segments per page
 * @returns Object containing matched entries, patches, and unlinked entries
 */
const matchEntriesBySegments = (book: ShamelaBook, entries: Entry[], isMulti: boolean) => {
    const patches: Partial<Entry>[] = [];

    const arabicEntries = mapBookPagesToEntries(book.pages, isMulti);

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

    return { ...indexEntriesForLookup(arabicEntries as Entry[]), patches, unlinked };
};

/**
 * Matches entries with book pages using fuzzy matching on full page content
 * @param book - The Shamela book data to match against
 * @param entries - Array of entries to be matched
 * @returns Object containing patches and unlinked entries
 */
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

/**
 * Migrates entries by matching them with Shamela book data and updating page references
 * Uses multiple matching strategies and prompts user for confirmation before saving changes
 * @returns Promise that resolves when migration completes
 */
export const migrateEntries = async () => {
    process.argv = process.argv.filter((s) => s !== '--migrate');

    const { book, entries, isMulti } = await loadData();

    logger.info(`${entries.length} entries to link...`);

    let { patches, unlinked, indexToEntries } = matchEntriesBySegments(book, entries, isMulti);

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
            patches.filter((p) => p.from),
            null,
            2,
        )}?`,
    });

    if (confirmed) {
        await saveEntries(patches as Entry[], logger.level === 'debug');
    }
};
