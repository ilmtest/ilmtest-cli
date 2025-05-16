#!/usr/bin/env bun
import { select } from '@inquirer/prompts';
import welcome from 'cli-welcome';

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

    const action = await select({
        choices: [
            { name: 'AI Transcribe', value: 'transcribe' },
            { name: 'Check Asl', value: 'checkAsl' },
            { name: 'Delete Asl', value: 'deleteAsl' },
            { name: 'Download Asl', value: 'downloadAsl' },
            { name: 'Upload Asl', value: 'uploadAsl' },
        ],
        default: 'transcribe',
        message: 'Select language',
    });

    await loadConfiguration(packageJson.name, [
        'collectionsEndpoint',
        'tafrighApiKeys',
        'awsRegion',
        'awsAccessKey',
        'awsSecretKey',
        'awsBucket',
    ]);

    if (action === 'transcribe') {
        await (await import('./actions/transcribe.js')).transcribeWithAI();
    } else if (action === 'deleteAsl') {
        await (await import('./actions/deleteAsl.js')).deleteAsl();
    } else if (action === 'checkAsl') {
        await (await import('./actions/checkAsl.js')).checkAsl();
    } else if (action === 'downloadAsl') {
        await (await import('./actions/downloadAsl.js')).downloadAsl();
    } else if (action === 'uploadAsl') {
        await (await import('./actions/uploadAsl.js')).uploadAsl();
    }
};

main();
