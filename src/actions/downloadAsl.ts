import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { input } from '@inquirer/prompts';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import config from '../utils/config.js';
import logger from '../utils/logger.js';

export const downloadAsl = async () => {
    const collectionId = await input({
        message: 'Enter collection ID to download:',
        required: true,
        validate: (page) => (/\d+/.test(page) ? true : 'Please enter a valid collection ID'),
    });

    const s3Client = new S3Client({
        credentials: {
            accessKeyId: config.awsAccessKey,
            secretAccessKey: config.awsSecretKey,
        },
        region: config.awsRegion,
    });

    const file = path.format({ ext: '.json', name: collectionId });

    logger.info(`Downloading ${config.awsBucket}/${file}`);

    const response = await s3Client.send(new GetObjectCommand({ Bucket: config.awsBucket, Key: file }));
    const data = (await response.Body?.transformToString()) as string;

    s3Client.destroy();

    logger.info(`Saving file ${file}`);

    return fs.writeFile(file, data);
};
