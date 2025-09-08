import { confirm } from '@inquirer/prompts';
import { calculateSimilarity, normalizeArabicText } from 'baburchi';

import type { Entry } from '@/api/entries.js';

import logger from '@/utils/logger.js';

import { loadData, mapBookPagesToEntries, saveEntries } from './shamela.js';
import { getEntryKey, indexEntriesByNumber } from './translate/utils.js';

const createPatch = (originalEntry: Entry, newPage: Entry) => {
    return {
        from: newPage.from,
        id: originalEntry.id,
        pp: newPage.pp,
        ...(newPage.volume && { volume: newPage.volume }),
        ...(originalEntry.to && { to: newPage.from + 1 }),
    };
};

export const migrateEntries = async () => {
    process.argv = process.argv.filter((s) => s !== '--migrate');
    const { book, entries, max } = await loadData({ loadFullEntries: true });
    const arabicEntries = mapBookPagesToEntries(book, { markerPattern: /^\[\] (.*)/, max }).map(
        (e) => ({ ...e, arabic: normalizeArabicText(e.arabic!) }) as Entry,
    );

    const { indexToEntries, pageToEntries } = indexEntriesByNumber(arabicEntries);
    const entriesWithUnmatchedTexts: Partial<Entry>[] = [];

    const updatedEntries: Partial<Entry>[] = entries.flatMap((e) => {
        const normalizedArabic = normalizeArabicText(e.arabic!);

        if (e.index) {
            const [entry] = indexToEntries[getEntryKey(e)];

            if (entry.from === e.from) {
                // page has not changed in this new version, no-op
                return [];
            }

            if (calculateSimilarity(normalizedArabic, entry.arabic!) >= 0.6) {
                // page has shifted but kept the same index
                return [createPatch(e, entry)];
            } else {
                entriesWithUnmatchedTexts.push(createPatch(e, entry));
            }

            return [];
        }

        const [entry] = pageToEntries[e.from];

        if (calculateSimilarity(normalizedArabic, entry.arabic!) >= 0.6) {
            // non-numeric page but the page number is intact
            return [];
        }

        // page text does not match, we need to find the correct page
        const [similar, another] = arabicEntries.filter((a) => calculateSimilarity(normalizedArabic, a.arabic!) >= 0.6);

        if (!similar) {
            throw new Error(`Similar text not found for ${e.id}`);
        }

        if (another) {
            throw new Error(
                `Multiple similar entries found: ${JSON.stringify(e, null, 2)} with ${JSON.stringify([similar, another], null, 2)}`,
            );
        }

        return [createPatch(e, similar)];
    });

    if (entriesWithUnmatchedTexts.length) {
        // page has shifted, but the texts don't match
        const force = await confirm({
            message: `The index matched but the text did not match for ${JSON.stringify(entriesWithUnmatchedTexts, null, 2)} Do you want to force those?`,
        });

        if (force) {
            updatedEntries.push(...entriesWithUnmatchedTexts);
        }
    }

    logger.debug(JSON.stringify(updatedEntries, null, 2));

    await saveEntries(updatedEntries as Entry[], logger.level === 'debug');
};
