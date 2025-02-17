#!/usr/bin/env bun
import { select } from '@inquirer/prompts';
import welcome from 'cli-welcome';

import packageJson from '../package.json' assert { type: 'json' };
import { transcribeWithAI } from './actions/transcribe.js';
import { loadConfiguration } from './utils/config.js';

const main = async () => {
    welcome({
        bgColor: `#FADC00`,
        bold: true,
        color: `#000000`,
        title: packageJson.name,
        version: packageJson.version,
    });

    await loadConfiguration(packageJson.name, ['collectionsEndpoint', 'tafrighApiKeys']);

    const action = await select({
        choices: [{ name: 'AI Transcribe', value: 'transcribe' }],
        default: 'transcribe',
        message: 'Select language',
    });

    if (action === 'transcribe') {
        await transcribeWithAI();
    }
};

main();
