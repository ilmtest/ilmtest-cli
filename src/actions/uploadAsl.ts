import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { confirm, input } from '@inquirer/prompts';
import { promises as fs } from 'node:fs';

import config from '../utils/config.js';
import logger from '../utils/logger.js';

export const uploadAsl = async () => {
    const collectionId = await input({
        message: 'Enter collection ID to upload:',
        required: true,
        validate: (id) => (/\d+/.test(id) ? true : 'Please enter a valid collection ID'),
    });

    const filePath = await input({
        message: 'Enter the path to the JSON file:',
        required: true,
        validate: async (file) => {
            if (!file.endsWith('.json')) {
                return 'The asl must be a .json file';
            }

            try {
                await fs.access(file);
                return true;
            } catch {
                return 'File does not exist. Please enter a valid file path';
            }
        },
    });

    const s3Client = new S3Client({
        credentials: {
            accessKeyId: config.awsAccessKey,
            secretAccessKey: config.awsSecretKey,
        },
        region: config.awsRegion,
    });

    const fileName = `${collectionId}.json`;

    logger.info(`Uploading ${fileName} to ${config.awsBucket}`);

    await s3Client.send(
        new PutObjectCommand({
            Body: await fs.readFile(filePath),
            Bucket: config.awsBucket,
            ContentType: 'application/json',
            Key: fileName,
        }),
    );

    s3Client.destroy();

    logger.info(`Upload successful: ${fileName}`);

    const deleteFile = await confirm({ message: `Do we you want to delete ${filePath}` });

    if (deleteFile) {
        await fs.rm(filePath, { recursive: true });
    }
};
