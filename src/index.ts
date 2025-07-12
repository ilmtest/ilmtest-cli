#!/usr/bin/env bun
import { select } from '@inquirer/prompts';
import welcome from 'cli-welcome';
import { parseArgs } from 'node:util';

import packageJson from '../package.json' with { type: 'json' };
import { loadConfiguration } from './utils/config.js';
import { handlePromptTermination } from './utils/io.js';

const main = async () => {
    welcome({
        bgColor: `#FADC00`,
        bold: true,
        clear: false,
        color: `#000000`,
        title: packageJson.name,
        version: packageJson.version,
    });

    handlePromptTermination();

    const { positionals, values } = parseArgs({
        allowPositionals: true,
        options: {
            compileManuscript: {
                short: 'c',
                type: 'boolean',
            },
            downloadAsl: {
                short: 'd',
                type: 'string',
            },
            migrateChats: {
                short: 'm',
                type: 'string',
            },
            preview: {
                type: 'boolean',
            },
            transcribe: {
                short: 't',
                type: 'boolean',
            },
            translate: {
                type: 'boolean',
            },
        },
        strict: true,
    });

    let action =
        Object.keys(values).length === 0 &&
        (await select({
            choices: [
                { name: 'AI Transcribe', value: 'transcribe' },
                { name: 'AI Translate', value: 'translate' },
                { name: 'Check Asl', value: 'checkAsl' },
                { name: 'Compile Manuscript', value: 'compileManuscript' },
                { name: 'Delete Asl', value: 'deleteAsl' },
                { name: 'Download Asl', value: 'downloadAsl' },
                { name: 'Migrate ChatGPT Conversations', value: 'migrateChats' },
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

    if (values.compileManuscript) {
        action = 'compileManuscript';
    }

    if (values.migrateChats) {
        action = 'migrateChats';
    }

    if (values.transcribe) {
        action = 'transcribe';
    }

    if (values.downloadAsl) {
        action = 'downloadAsl';
    }

    if (values.translate) {
        action = 'translate';
    }

    if (action === 'transcribe') {
        await (await import('./actions/transcribe.js')).transcribeWithAI(positionals[0], positionals[1]);
    } else if (action === 'deleteAsl') {
        await (await import('./actions/deleteAsl.js')).deleteAsl();
    } else if (action === 'checkAsl') {
        await (await import('./actions/checkAsl.js')).checkAsl();
    } else if (action === 'downloadAsl') {
        await (await import('./actions/downloadAsl.js')).downloadAsl(values.downloadAsl);
    } else if (action === 'migrateChats') {
        await (
            await import('./actions/migrateChats/index.js')
        ).migrateChats(values.migrateChats, positionals[0], positionals[1]);
    } else if (action === 'uploadAsl') {
        await (await import('./actions/uploadAsl.js')).uploadAsl();
    } else if (action === 'translate') {
        await (
            await import('./actions/translate/index.js')
        ).translateWithAI({ collection: positionals[0], isPreview: values.preview, translator: positionals[1] });
    }
};

main();
