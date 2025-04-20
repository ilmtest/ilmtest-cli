import { confirm, input } from '@inquirer/prompts';
import { file, gzipSync, S3Client } from 'bun';
import path from 'node:path';

import config from '../utils/config.js';
import logger from '../utils/logger.js';

const sanitizeInput = (input: string) => input.replace(/\\ /g, ' ').trim();

export const uploadAsl = async () => {
    const filePath = sanitizeInput(
        await input({
            message: 'Enter the path to the JSON file:',
            required: true,
            transformer: (val) => sanitizeInput(val),
            validate: async (input) => {
                const f = sanitizeInput(input);

                if (!f.endsWith('.json')) {
                    return 'The asl must be a .json file';
                }

                if (await file(f).exists()) {
                    return true;
                }

                return 'File does not exist. Please enter a valid file path';
            },
        }),
    );

    const collectionFile = file(filePath);
    const collectionId = await input({
        default: path.parse(filePath).name,
        message: 'Enter collection ID to upload:',
        required: true,
        validate: (id) => (/\d+/.test(id) ? true : 'Please enter a valid collection ID'),
    });

    logger.info(`Compressing ${filePath}`);

    const s3Client = new S3Client({
        accessKeyId: config.awsAccessKey,
        bucket: config.awsBucket,
        region: config.awsRegion,
        secretAccessKey: config.awsSecretKey,
    });

    const legacyFile = `${collectionId}.json`;

    if (await s3Client.exists(legacyFile)) {
        const shouldDeleteLegacy = await confirm({
            message: `${legacyFile} was already found. Do you want to delete it?`,
        });

        if (shouldDeleteLegacy) {
            logger.info(`Deleting ${legacyFile}`);
            await s3Client.delete(legacyFile);
            logger.info(`Deleted ${legacyFile}`);
        }
    }

    logger.info(`Uploading ${collectionId}.json.gz to ${config.awsBucket}`);
    await s3Client.write(
        `${collectionId}.json.gz`,
        gzipSync(await collectionFile.arrayBuffer(), { level: 9, memLevel: 9, windowBits: 31 }),
    );

    const deleteFile = await confirm({ message: `Do we you want to delete ${filePath}` });

    if (deleteFile) {
        await collectionFile.delete();
    }
};
