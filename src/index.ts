#!/usr/bin/env bun
import { select } from '@inquirer/prompts';
import welcome from 'cli-welcome';
import { parseArgs } from 'node:util';

import packageJson from '../package.json' assert { type: 'json' };
import { loadConfiguration } from './utils/config.js';

const main = async () => {
    welcome({
        bgColor: `#FADC00`,
        bold: true,
        color: `#000000`,
        title: packageJson.name,
        version: packageJson.version,
    });

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
            transcribe: {
                short: 't',
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
                { name: 'Check Asl', value: 'checkAsl' },
                { name: 'Compile Manuscript', value: 'compileManuscript' },
                { name: 'Delete Asl', value: 'deleteAsl' },
                { name: 'Download Asl', value: 'downloadAsl' },
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

    if (values.transcribe) {
        action = 'transcribe';
    }

    if (values.downloadAsl) {
        action = 'downloadAsl';
    }

    if (action === 'transcribe') {
        await (await import('./actions/transcribe.js')).transcribeWithAI(positionals[0], positionals[1]);
    } else if (action === 'deleteAsl') {
        await (await import('./actions/deleteAsl.js')).deleteAsl();
    } else if (action === 'checkAsl') {
        await (await import('./actions/checkAsl.js')).checkAsl();
    } else if (action === 'downloadAsl') {
        await (await import('./actions/downloadAsl.js')).downloadAsl(values.downloadAsl);
    } else if (action === 'uploadAsl') {
        await (await import('./actions/uploadAsl.js')).uploadAsl();
    } else if (action === 'compileManuscript') {
        await (await import('./actions/compileManuscript.js')).compileManuscript(positionals[0]);
    }
};

main();
