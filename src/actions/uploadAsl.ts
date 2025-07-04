import { confirm, input } from '@inquirer/prompts';
import { gzipSync, S3Client } from 'bun';
import path from 'node:path';

import config from '../utils/config.js';
import { getFileSystemInput } from '../utils/io.js';
import logger from '../utils/logger.js';

export const uploadAslToS3 = async (collectionId: string, filePath: string) => {
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

    logger.info(`Compressing and uploading ${collectionId}.json.gz to ${config.awsBucket}`);

    const collectionFile = Bun.file(filePath);

    await s3Client.write(
        `${collectionId}.json.gz`,
        gzipSync(await collectionFile.arrayBuffer(), { level: 9, memLevel: 9, windowBits: 31 }),
    );

    return collectionFile;
};

export const uploadAsl = async () => {
    const filePath = await getFileSystemInput({
        message: 'Enter the path to the JSON file:',
        validate: async (f) => {
            if (!f.endsWith('.json')) {
                return 'The asl must be a .json file';
            }

            if (await Bun.file(f).exists()) {
                return true;
            }

            return 'File does not exist. Please enter a valid file path';
        },
    });

    const collectionId = await input({
        default: path.parse(filePath).name,
        message: 'Enter collection ID to upload:',
        required: true,
        validate: (id) => (/\d+/.test(id) ? true : 'Please enter a valid collection ID'),
    });

    const collectionFile = await uploadAslToS3(collectionId, filePath);
    const deleteFile = await confirm({ message: `Do you want to delete ${filePath}` });

    if (deleteFile) {
        await collectionFile.delete();
    }
};
