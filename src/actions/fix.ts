import path from 'node:path';
import type { Entry } from '@/api/entries.js';
import { OUTPUT_DIR } from '@/utils/constants.js';
import { fixGaps } from '@/utils/entryUtils.js';
import logger from '@/utils/logger.js';

const mergeLoosePages = (entries: Entry[], prefix = 'P') => {
    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];

        if (entry.translation && entry.index) {
            // find every P id that doesn't have a translation and merge
            for (let j = i + 1; j < entries.length; j++) {
                const page = entries[j];

                if (page.id.startsWith(prefix) && !page.translation && !page.index) {
                    entry.arabic += ` ${page.arabic}`;

                    if (entry.from !== page.from) {
                        entry.to = page.from;
                    }

                    logger.info(`Adding to: ${entry.id}`);
                } else {
                    break;
                }
            }
        }
    }

    return entries.filter((entry) => {
        return !entry.id.startsWith(prefix) || entry.translation;
    });
};

export const fixExcerpts = async (collectionId: string, type: string) => {
    const dir = path.join(OUTPUT_DIR, collectionId);
    const excerptFile = Bun.file(path.join(dir, 'excerpts.json'));
    let entries: Entry[] = await excerptFile.json();

    if (type === 'merge') {
        entries = mergeLoosePages(entries);
    } else if (type === 'indices') {
        entries = fixGaps(entries);
    }

    await excerptFile.write(JSON.stringify(entries, null, 2));
    logger.info(`${entries.length} saved to ${excerptFile.name}`);
};
