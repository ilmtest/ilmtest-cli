import { parseArgs } from 'node:util';

import logger from '@/utils/logger.js';

/**
 * Loads a translation file from the filesystem
 * @param positionals - Array of file paths, first element is used as the translation file path
 * @returns Promise that resolves to an object containing the file data and file handle
 * @throws Will throw an error if the file does not exist
 */
const loadTranslation = async (positionals: string[]) => {
    const translationFile = Bun.file(positionals[0]);

    if (!(await translationFile.exists())) {
        throw new Error('File not found');
    }

    const data = await translationFile.text();

    return { data, translationFile };
};

/**
 * Adjusts indices in translation files based on command line arguments
 * Supports both numeric diff adjustments and text formatting operations
 * @returns Promise that resolves when the operation completes
 * @throws Will throw an error if no diff is specified
 */
export const adjustIndices = async () => {
    const { positionals, values } = parseArgs({
        allowPositionals: true,
        options: {
            diff: {
                type: 'string',
            },
            preview: {
                type: 'boolean',
            },
        },
        strict: true,
    });

    if (!values.diff) {
        throw new Error('No diff specified');
    }

    // eslint-disable-next-line prefer-const
    let { data, translationFile } = await loadTranslation(positionals);

    const diff = Number(values.diff);
    data = data.replace(/^N(\d+)/gm, (_match, num) => `N${Number(num) + diff}`);

    if (values.preview) {
        return logger.info(data);
    }

    await translationFile.write(data);
};
