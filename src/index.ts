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
            { name: 'Download Asl', value: 'downloadAsl' },
            { name: 'Upload Asl', value: 'uploadAsl' },
        ],
        default: 'transcribe',
        message: 'Select language',
    });

    if (action === 'transcribe') {
        await loadConfiguration(packageJson.name, ['collectionsEndpoint', 'tafrighApiKeys']);
        await (await import('./actions/transcribe.js')).transcribeWithAI();
    } else if (action === 'downloadAsl' || action === 'uploadAsl') {
        await loadConfiguration(packageJson.name, ['awsRegion', 'awsAccessKey', 'awsSecretKey', 'awsBucket']);

        if (action === 'downloadAsl') {
            await (await import('./actions/downloadAsl.js')).downloadAsl();
        } else if (action === 'uploadAsl') {
            await (await import('./actions/uploadAsl.js')).uploadAsl();
        }
    }
};

main();
