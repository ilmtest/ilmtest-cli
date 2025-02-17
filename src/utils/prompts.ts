import { input as prompt, select } from '@inquirer/prompts';
import os from 'node:os';
import path from 'node:path';

export const getAnswers = async () => {
    const pdf = await prompt({
        message: 'Enter the pdf file name in the bucket to OCR:',
        required: true,
        transformer: (input) => input.trim(),
        validate: (input) => (input.endsWith('.pdf') ? true : 'PDF file is required.'),
    });

    const resumeToken = await prompt({
        message: 'Enter the existing request ID:',
        transformer: (input) => input.trim(),
    });

    const volume = await prompt({
        default: '1',
        message: 'Enter the volume number:',
        transformer: (input) => input.trim(),
        validate: (input) => (input.match(/^\d+$/) ? true : 'Numeric volume number is required.'),
    });

    const outputFileName = await prompt({
        default: path.format({ ext: '.json', name: path.parse(pdf).name }),
        message: 'Enter the output file name:',
        transformer: (input) => input.trim(),
        validate: (input) => (input.endsWith('.json') ? true : 'Output file is required.'),
    });

    const language = await select({
        choices: [
            { name: 'Collections', value: 'collections' },
            { name: 'English', value: 'en' },
        ],
        default: 'ar',
        message: 'Select language',
    });

    const outputFolder = path.join(os.tmpdir(), path.parse(outputFileName).name);

    return { language, outputFileName, outputFolder, pdf, resumeToken, volume: parseInt(volume, 10) };
};
