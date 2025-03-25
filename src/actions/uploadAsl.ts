import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { confirm, input } from '@inquirer/prompts';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import config from '../utils/config.js';
import { compressFile } from '../utils/io.js';
import logger from '../utils/logger.js';

const sanitizeInput = (input: string) => input.replace(/\\ /g, ' ').trim();

export const uploadAsl = async () => {
    const filePath = sanitizeInput(
        await input({
            message: 'Enter the path to the JSON file:',
            required: true,
            transformer: (val) => sanitizeInput(val),
            validate: async (input) => {
                const file = sanitizeInput(input);

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
        }),
    );

    const collectionId = await input({
        default: path.parse(filePath).name,
        message: 'Enter collection ID to upload:',
        required: true,
        validate: (id) => (/\d+/.test(id) ? true : 'Please enter a valid collection ID'),
    });

    logger.info(`Compressing ${filePath}`);

    const gzippedFilePath = await compressFile(filePath, `${filePath}.gz`);

    logger.info(`Successfully compressed file to ${gzippedFilePath}`);

    const s3Client = new S3Client({
        credentials: {
            accessKeyId: config.awsAccessKey,
            secretAccessKey: config.awsSecretKey,
        },
        region: config.awsRegion,
    });

    try {
        const legacyFile = `${collectionId}.json`;
        await s3Client.send(new HeadObjectCommand({ Bucket: config.awsBucket, Key: legacyFile }));

        const shouldDeleteLegacy = await confirm({
            message: `${legacyFile} was already found. Do you want to delete it?`,
        });

        if (shouldDeleteLegacy) {
            logger.info(`Deleting ${legacyFile}`);
            await s3Client.send(new DeleteObjectCommand({ Bucket: config.awsBucket, Key: legacyFile }));
            logger.info(`Deleted ${legacyFile}`);
        }
    } catch (err: any) {
        if (err.name !== 'NotFound') {
            logger.error(err);
        }
    }

    const fileName = `${collectionId}.json.gz`;

    logger.info(`Uploading ${fileName} to ${config.awsBucket}`);

    await s3Client.send(
        new PutObjectCommand({
            Body: await fs.readFile(gzippedFilePath),
            Bucket: config.awsBucket,
            ContentType: 'application/json',
            Key: fileName,
        }),
    );

    s3Client.destroy();

    logger.info(`Upload successful: ${fileName}`);

    await fs.rm(gzippedFilePath, { recursive: true });

    const deleteFile = await confirm({ message: `Do we you want to delete ${filePath}` });

    if (deleteFile) {
        await fs.rm(filePath, { recursive: true });
    }
};
