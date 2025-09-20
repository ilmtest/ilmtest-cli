import path from 'node:path';
import { confirm } from '@inquirer/prompts';
import { gzipSync, S3Client } from 'bun';

import config from '../utils/config.js';
import { getFileSystemInput, getNumericInput } from '../utils/io.js';
import logger from '../utils/logger.js';

/**
 * Uploads an ASL collection file to S3 storage with compression
 * @param collectionId - The ID of the collection to upload
 * @param filePath - Path to the local file to upload
 * @returns Promise that resolves to the uploaded file handle
 */
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

/**
 * Interactive function to upload an ASL collection to S3 storage
 * Prompts user for file path and collection ID, then uploads with compression
 * @returns Promise that resolves when upload completes
 */
export const uploadAsl = async () => {
    const filePath = await getFileSystemInput();

    const collectionId = await getNumericInput(
        'Enter collection ID to upload:',
        'Please enter a valid collection ID',
        path.parse(filePath).name,
    );

    const collectionFile = await uploadAslToS3(collectionId, filePath);
    const deleteFile = await confirm({ message: `Do you want to delete ${filePath}` });

    if (deleteFile) {
        await collectionFile.delete();
    }
};
