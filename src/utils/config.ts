import { input } from '@inquirer/prompts';
import Conf from 'conf';
import { init as initTafrigh } from 'tafrigh';

import { Config } from '../types.js';
import logger from './logger.js';

const configData: Config = {} as Config;

const mapKeyToPrompt = (key: string) => {
    return {
        key,
        message: `Enter ${key}:`,
        required: true,
        transformer: (input: string) => input.trim(),
        validate: (input: string) => (input ? true : `${key} is required.`),
    };
};

export const loadConfiguration = async (projectName: string, keys: string[]): Promise<void> => {
    const config = new Conf({ projectName });
    const prompts = keys.filter((key) => !config.has(key)).map(mapKeyToPrompt);

    for (const { key, ...prompt } of prompts) {
        const answer = await input(prompt);
        config.set(key, answer);
    }

    const result = keys.reduce((acc, key) => ({ ...acc, [key]: config.get(key) as string }), {});

    Object.assign(configData, result);

    initTafrigh({ apiKeys: configData.tafrighApiKeys.split(' ') });

    logger.info({ config, ...configData });
};

export default configData;
