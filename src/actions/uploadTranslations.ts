import path from 'node:path';
import { magentaBright, yellow } from 'ansis';
import { addOrUpdateEntry, type Entry, EntryType } from '@/api/entries.js';
import { OUTPUT_DIR } from '@/utils/constants.js';
import { getEntryKey } from '@/utils/entryUtils.js';
import logger from '@/utils/logger.js';

type PatchedEntry = Partial<Entry> & Pick<Entry, 'id'>;

export const saveEntries = async (entries: Entry[] | PatchedEntry[], isPreview: boolean) => {
    for (const entry of entries.toSorted((a, b) => (a.from || 0) - (b.from || 0))) {
        if (entry.id) {
            logger.info(`Update ${JSON.stringify(entry, null, 2)}`);
        } else if (!entry.type) {
            logger.info(
                `Add new entry at page: ${magentaBright(entry.from)}${entry.to ? `-${magentaBright(entry.to)}` : ''} with index ${yellow(entry.index)}`,
            );
        } else if (entry.type === EntryType.Chapter) {
            logger.info(`Add new chapter at page: ${magentaBright(entry.from)}`);
        } else {
            logger.info(`Unknown entry type being added at: ${magentaBright(entry.from)}`);
        }

        if (isPreview) {
            logger.info(`Text: ${entry.translation}\n${entry.arabic}\n\n`);
        } else {
            await addOrUpdateEntry(entry);
        }
    }

    if (entries[0]?.url) {
        logger.info(`Using url: ${entries[0].url}`);
    }
};

const hashEntry = (e: Entry) => `${getEntryKey(e)}@${e.from}`;

export const uploadTranslations = async (collectionId: string) => {
    const dir = path.join(OUTPUT_DIR, collectionId);

    const [excerpts, entries]: [Entry[], Entry[]] = await Promise.all([
        Bun.file(path.join(dir, 'excerpts.json')).json(),
        await Bun.file(path.join(dir, 'entries.json')).json(),
    ]);

    const idToEntries = Object.groupBy(entries, hashEntry);

    const newEntries: Entry[] = [];
    const updatedEntries: PatchedEntry[] = [];

    for (const e of excerpts) {
        const key = hashEntry(e);
        const [entry] = idToEntries[key] || [];

        if (e.translation || e.commentary) {
            if (entry) {
                updatedEntries.push({ commentary: e.translation, id: entry.id });
            } else {
                newEntries.push({ ...e, id: '', volume: e.volume || 1 });
            }
        }
    }

    await saveEntries(updatedEntries, false);
    await saveEntries(newEntries, false);
};
