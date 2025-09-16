import { parseArgs } from 'node:util';

import logger from '@/utils/logger.js';

const loadTranslation = async (positionals: string[]) => {
    const translationFile = Bun.file(positionals[0]);

    if (!(await translationFile.exists())) {
        throw new Error('File not found');
    }

    const data = await translationFile.text();

    return { data, translationFile };
};

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

    if (diff) {
        data = data.replace(/^(\d+)/gm, (_match, num) => (Number(num) + diff).toString());
    } else {
        data = data.replace(/ (\d+) -/gm, '\n$1 -');
        data = data.replace(/\\\[/gm, '[');
    }

    if (values.preview) {
        return logger.info(data);
    }

    await translationFile.write(data);
};
