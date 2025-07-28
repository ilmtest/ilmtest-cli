import { parseArgs } from 'node:util';

import { getNumericInput } from '../../utils/io.js';

export const promptTranslateInputs = async () => {
    const { values } = parseArgs({
        options: {
            autoFix: {
                type: 'boolean',
            },
            collection: {
                type: 'string',
            },
            diff: {
                type: 'string',
            },
            discrete: {
                type: 'boolean',
            },
            footnotes: {
                type: 'boolean',
            },
            pages: {
                type: 'string',
            },
            preview: {
                type: 'boolean',
            },
            refresh: {
                type: 'boolean',
            },
            translate: {
                type: 'boolean',
            },
            translator: {
                type: 'string',
            },
            walk: {
                type: 'boolean',
            },
        },
        strict: true,
    });

    const diff = values.diff
        ? Number(values.diff.startsWith('n') ? '-' + values.diff.slice(1) : values.diff)
        : undefined;

    const collectionId =
        values.collection ||
        (await getNumericInput('Enter collection ID to translate:', 'Please enter a valid collection ID'));

    if (diff) {
        return {
            autoFix: false,
            collectionId,
            fromPage: 1,
            isPreview: true,
            refresh: false,
            removeFootnotes: false,
            toPage: 1,
            translatorId: '1',
            walk: false,
        };
    }

    const translatorId =
        values.translator || (await getNumericInput('Enter translator ID:', 'Please enter a valid translator ID'));

    const fromPage =
        values.pages?.split('-')[0] ||
        (await getNumericInput('Enter page to start from:', 'Please enter a valid page number', '1'));

    const toPage =
        values.pages?.split('-').at(-1) ||
        (await getNumericInput(
            'Enter page to end:',
            'Please enter a valid page number',
            Number.MAX_SAFE_INTEGER.toString(),
        ));

    return {
        autoFix: Boolean(values.autoFix),
        collectionId,
        diff,
        discrete: Boolean(values.discrete),
        fromPage: Number(fromPage),
        isPreview: Boolean(values.preview),
        refresh: Boolean(values.refresh),
        removeFootnotes: !values.footnotes,
        toPage: Number(toPage),
        translatorId,
        walk: Boolean(values.walk),
    };
};
