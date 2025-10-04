#!/usr/bin/env bun
import { parseArgs } from 'node:util';
import { select } from '@inquirer/prompts';
import welcome from 'cli-welcome';

import packageJson from '../package.json' with { type: 'json' };
import { loadConfiguration } from './utils/config.js';

const main = async () => {
    welcome({
        bgColor: `#FADC00`,
        bold: true,
        clear: false,
        color: `#000000`,
        title: packageJson.name,
        version: packageJson.version,
    });

    //handlePromptTermination();

    const { positionals, values } = parseArgs({
        allowPositionals: true,
        options: {
            compile: {
                type: 'boolean',
            },
            diff: {
                type: 'string',
            },
            download: {
                type: 'string',
            },
            extract: {
                type: 'boolean',
            },
            fix: {
                type: 'string',
            },
            migrate: {
                type: 'string',
            },
            save: {
                type: 'string',
            },
            shamela: {
                type: 'string',
            },
            transcribe: {
                short: 't',
                type: 'boolean',
            },
        },
        strict: false,
    });

    let action =
        Object.keys(values).length === 0 &&
        (await select({
            choices: [
                { name: 'AI Transcribe', value: 'transcribe' },
                { name: 'AI Translate', value: 'translate' },
                { name: 'Check Asl', value: 'checkAsl' },
                { name: 'Delete Asl', value: 'deleteAsl' },
                { name: 'Extract', value: 'extract' },
                { name: 'Upload Asl', value: 'uploadAsl' },
            ],
            default: 'transcribe',
            message: 'Select language',
        }));

    await loadConfiguration(packageJson.name, [
        'collectionsEndpoint',
        'tafrighApiKeys',
        'awsRegion',
        'awsAccessKey',
        'awsSecretKey',
        'awsBucket',
    ]);

    if (values.transcribe) {
        action = 'transcribe';
    }

    if (values.extract) {
        action = 'extract';
    }

    if (values.transcribe) {
        await (await import('./actions/transcribe.js')).transcribeWithAI(...positionals);
    } else if (action === 'deleteAsl') {
        await (await import('./actions/deleteAsl.js')).deleteAsl();
    } else if (action === 'checkAsl') {
        await (await import('./actions/checkAsl.js')).checkAsl();
    } else if (values.download) {
        await (await import('./actions/downloadAsl.js')).downloadAsl(values.download as string);
    } else if (action === 'extract') {
        await (await import('./actions/extractor.js')).extractor();
    } else if (action === 'uploadAsl') {
        await (await import('./actions/uploadAsl.js')).uploadAsl();
    } else if (values.shamela) {
        await (await import('./actions/shamela.js')).processShamela();
    } else if (values.migrate) {
        await (await import('./actions/migrate.js')).migrateEntries(values.migrate as string);
    } else if (values.diff) {
        await (await import('./actions/adjust.js')).adjustIndices();
    } else if (values.compile) {
        await (await import('./actions/compile.js')).compileTranslation(positionals[0], positionals[1]);
    } else if (values.save) {
        await (await import('./actions/uploadTranslations.js')).uploadTranslations(values.save as string);
    } else if (values.fix) {
        await (await import('./actions/fix.js')).fixExcerpts(positionals[0], values.fix as string);
    }
};

main();
