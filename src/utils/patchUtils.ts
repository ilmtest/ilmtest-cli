import { findMatches } from 'baburchi';
import type { Entry } from '@/api/entries.js';
import type { ArabicEntry, ShamelaBook, ShamelaPage } from '@/types.js';
import { getEntryKey, indexChaptersForLookup, indexEntriesForLookup } from './entryUtils.js';
import { segmentPages } from './mapping.js';

const PRECISE_MATCH_CONFIG = {
    // Enable fuzzy matching for better coverage
    enableFuzzy: true,
    gramsPerExcerpt: 8, // More grams = more selective candidates

    // Increase candidate generation for better coverage
    maxCandidatesPerExcerpt: 200, // More candidates = better chance of finding best match

    // Conservative edit distance thresholds
    maxEditAbs: 2, // Allow max 2 character errors for short excerpts
    maxEditRel: 0.05, // Allow max 5% character errors (very strict)

    // Optimize q-gram length for your typical excerpt size
    q: 3, // Good balance - use 2 for very short excerpts, 4+ for longer ones

    // Generous seam length for cross-page matches
    seamLen: 100, // Capture enough context at page boundaries
};

export const SHORTER_MATCH_CONFIG = {
    enableFuzzy: true,
    gramsPerExcerpt: 5,
    maxCandidatesPerExcerpt: 150,
    maxEditAbs: 1,
    maxEditRel: 0.1,
    q: 2, // Shorter q-grams for short text
    seamLen: 50,
};

export const LONGER_MATCH_CONFIG = {
    enableFuzzy: true,
    gramsPerExcerpt: 10,
    maxCandidatesPerExcerpt: 100, // Fewer candidates needed
    maxEditAbs: 5,
    maxEditRel: 0.08,
    q: 4, // Longer q-grams for selectivity
    seamLen: 150,
};

const POLICIES = [{ enableFuzzy: false }, PRECISE_MATCH_CONFIG, SHORTER_MATCH_CONFIG, LONGER_MATCH_CONFIG];

/**
 * Creates a patch object for updating entry page information
 * @param originalEntry - The original entry to be updated
 * @param newPage - New page information containing from, pp, and volume data
 * @returns Partial entry object with updated page information
 */
export const createPatch = (
    originalEntry: Pick<Entry, 'id' | 'to'>,
    newPage: Pick<Entry, 'from' | 'pp' | 'volume'>,
) => {
    return {
        from: newPage.from,
        id: originalEntry.id,
        pp: newPage.pp,
        ...(newPage.volume && { volume: newPage.volume }),
        ...(originalEntry.to && { to: newPage.from + 1 }),
    };
};

export const patchEntriesByIndex = (book: ShamelaBook, unlinked: Entry[], options: any) => {
    const patches: Partial<Entry>[] = [];

    const numberToPages = Object.groupBy(
        book.pages.filter((p) => p.number).map((p) => ({ from: p.id, number: p.number!, pp: p.pp, volume: p.volume })),
        (page) => page.number,
    );

    const arabicEntries = segmentPages(book.pages, options);
    const { indexToEntries } = indexEntriesForLookup(arabicEntries as Entry[], { scanMatn: true });

    const indexedNarrations = unlinked.filter((a) => a.index && a.type).sort((a, b) => a.index! - b.index!);

    for (const e of indexedNarrations) {
        const [page] = numberToPages[e.index!] || [];
        const [entry] = indexToEntries[getEntryKey(e)] || [];

        if (page) {
            patches.push(createPatch(e, page));
        } else if (entry) {
            patches.push(createPatch(e, entry));
        }
    }

    return patches;
};

const matchByPolicies = (matn: string, arabicEntries: ArabicEntry[]) => {
    const chapterTitles = arabicEntries.map((e) => e.arabic);

    for (const policy of POLICIES) {
        const [matched] = findMatches(chapterTitles, [matn], policy).map((index) => arabicEntries[index]);

        if (matched) {
            return matched;
        }
    }
};

const matchByWords = (matn: string, arabicEntries: ArabicEntry[]) => {
    const words = matn.split(' ').map((w) => w.trim());
    return arabicEntries.find((c) => words.every((w) => c.commentary!.includes(w)));
};

const findBestMatch = (matn: string, arabicEntries: ArabicEntry[]) => {
    if (arabicEntries.length === 1) {
        return arabicEntries[0];
    }

    for (const fn of [matchByPolicies, matchByWords]) {
        const matchedEntry = fn(matn, arabicEntries);

        if (matchedEntry) {
            return matchedEntry;
        }
    }
};

export const patchChaptersByMatn = (pages: ShamelaPage[], unlinkedChapters: Entry[]) => {
    const patches: Partial<Entry>[] = [];
    const matchedPageIds = new Set<number>();
    const matchedChapterIds = new Set<string>();

    for (const policy of POLICIES) {
        findMatches(
            pages.map((c) => c.content),
            unlinkedChapters.map((e) => e.arabic!),
            policy,
        ).forEach((matchedIndex, i) => {
            if (matchedIndex !== -1) {
                const entry = unlinkedChapters[i];
                const page = pages[matchedIndex];
                patches.push(createPatch(entry, { from: page.id, pp: page.pp, volume: page.volume }));

                matchedPageIds.add(page.id);
                matchedChapterIds.add(entry.id);
            }
        });

        pages = pages.filter((p) => !matchedPageIds.has(p.id));
        unlinkedChapters = unlinkedChapters.filter((e) => !matchedChapterIds.has(e.id));
    }

    for (const e of unlinkedChapters) {
        const words = e.arabic!.split(' ').map((w) => w.trim());
        const page = pages.find((p) => words.every((w) => p.content.includes(w)));

        if (page) {
            patches.push(createPatch(e, { from: page.id, pp: page.pp, volume: page.volume }));

            matchedPageIds.add(page.id);
            matchedChapterIds.add(e.id);
        }
    }

    pages = pages.filter((p) => !matchedPageIds.has(p.id));
    unlinkedChapters = unlinkedChapters.filter((e) => !matchedChapterIds.has(e.id));

    for (const page of pages) {
        const words = page.content.split(' ').map((w) => w.trim());
        const entry = unlinkedChapters.find((e) => words.every((w) => e.arabic!.includes(w)));

        if (entry) {
            patches.push(createPatch(entry, { from: page.id, pp: page.pp, volume: page.volume }));

            matchedPageIds.add(page.id);
            matchedChapterIds.add(entry.id);
        }
    }

    return patches;
};

export const patchChaptersByIndex = (book: ShamelaBook, unlinkedChapters: Entry[]) => {
    const indexToChapters = indexChaptersForLookup(book);

    const patches: Partial<Entry>[] = unlinkedChapters.flatMap((e) => {
        const key = getEntryKey(e);
        const chapis = indexToChapters[key];

        if (!chapis) {
            return [];
        }

        const matchedEntry = findBestMatch(e.arabic!, chapis);

        return matchedEntry ? [createPatch(e, matchedEntry)] : [];
    });

    return patches;
};
