import { input } from '@inquirer/prompts';
import { S3Client } from 'bun';

import config from '../utils/config.js';
import logger from '../utils/logger.js';

export const checkAsl = async () => {
    const collectionId = await input({
        message: 'Enter collection ID to check:',
        required: true,
        validate: (page) => (/\d+/.test(page) ? true : 'Please enter a valid collection ID'),
    });

    const s3Client = new S3Client({
        accessKeyId: config.awsAccessKey,
        bucket: config.awsBucket,
        region: config.awsRegion,
        secretAccessKey: config.awsSecretKey,
    });

    logger.info(`${collectionId}.json.gz exists: ${await s3Client.exists(`${collectionId}.json.gz`)}`);
};
