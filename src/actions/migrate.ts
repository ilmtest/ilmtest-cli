import { confirm } from '@inquirer/prompts';
import { findMatches } from 'baburchi';
import { stripHtml } from 'string-strip-html';
import { type Entry, EntryType } from '@/api/entries.js';
import type { ShamelaBook, ShamelaPage } from '@/types.js';
import { CAPTURE_CONTINUOUS_PAGES } from '@/utils/constants.js';
import { getEntryKey, indexEntriesForLookup } from '@/utils/entryUtils.js';
import logger from '@/utils/logger.js';
import { mapBookPagesToEntries } from '@/utils/mapping.js';
import { createPatch, patchChaptersByIndex, patchChaptersByMatn, patchEntriesByIndex } from '@/utils/patchUtils.js';
import { sanitizeChapter } from '@/utils/textUtils.js';
import { loadData } from './shamela.js';
import { saveEntries } from './uploadTranslations.js';

/**
 * Matches entries with book segments using fuzzy matching algorithms
 * @param book - The Shamela book data to match against
 * @param entries - Array of entries to be matched
 * @param isMulti - Whether the book has multiple segments per page
 * @returns Object containing matched entries, patches, and unlinked entries
 */
const matchEntriesBySegments = (book: ShamelaBook, entries: Entry[], multi?: string) => {
    const patches: Partial<Entry>[] = [];

    const arabicEntries = mapBookPagesToEntries(book.pages, {
        captureTrailing: multi === CAPTURE_CONTINUOUS_PAGES,
        isContinuous: Boolean(multi),
    });

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

            const { pp, id: from, volume } = book.pages[m];

            if (from !== entry.from || Number(volume) !== entry.volume || pp !== entry.pp) {
                patches.push(createPatch(entry, { from, pp: pp!, volume: Number(volume) }));
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
export const migrateEntries = async (strategy?: string) => {
    process.argv = process.argv.filter((s) => !s.includes('--migrate'));

    const { book, entries, multi } = await loadData();

    if (strategy === 'index') {
        const patches = patchEntriesByIndex(book, entries, multi);
        await saveEntries(patches as Entry[], logger.level === 'debug');

        return;
    } else if (strategy === 'chapters') {
        let unlinkedChapters = entries
            .filter((e) => e.type === EntryType.Chapter && e.index)
            .map(({ arabic, ...e }) => ({ ...e, arabic: sanitizeChapter(arabic!) }));

        const idToPage = Object.groupBy(book.pages, (p) => p.id);
        const patches = patchChaptersByIndex(book, unlinkedChapters);
        let patchedIds = new Set(patches.map((e) => e.id));
        const patchedPages = new Set(patches.map((p) => p.from!));

        unlinkedChapters = unlinkedChapters.filter((e) => !patchedIds.has(e.id));

        const titles: ShamelaPage[] = book.titles
            .filter((t) => t.content.startsWith('باب'))
            //.filter((t) => t.content.startsWith('كتاب'))
            //.filter((t) => t.content.startsWith('كتاب') || t.content.startsWith('باب'))
            .filter((t) => !patchedPages.has(t.page))
            .map((t) => {
                const [page] = idToPage[t.page]!;
                return {
                    content: sanitizeChapter(t.content),
                    id: t.page,
                    pp: page.pp,
                    volume: page.volume,
                };
            });

        patches.push(...patchChaptersByMatn(titles, unlinkedChapters));
        patchedIds = new Set(patches.map((e) => e.id));
        unlinkedChapters = unlinkedChapters.filter((e) => !patchedIds.has(e.id));

        unlinkedChapters.forEach((u) => {
            patches.unshift(createPatch(u, { from: null } as any));
        });

        await saveEntries(patches as any, false);

        return;
    }

    logger.info(`${entries.length} entries to link...`);

    let { patches, unlinked, indexToEntries } = matchEntriesBySegments(book, entries, multi);

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

            if (page && (page.from !== entry.from || page.pp !== entry.pp || page.volume !== entry.volume)) {
                patches.push(createPatch(entry, page as any));
            } else {
                remaining.push(entry);
            }
        });

        unlinked = remaining;

        logger.info(`${patches.length} entries linked, ${unlinked.length} could not be linked...`);
    }

    console.log('unlinked', unlinked);

    unlinked
        .filter((u) => u.from)
        .forEach((u) => {
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
