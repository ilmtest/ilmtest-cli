import { promises as fs } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { input } from '@inquirer/prompts';
import { S3Client } from 'bun';
import { OUTPUT_DIR } from '@/utils/constants.js';
import config from '../utils/config.js';
import { decompressFromStream } from '../utils/io.js';
import logger from '../utils/logger.js';

/**
 * Downloads an ASL collection from S3 storage, handling both compressed and uncompressed files
 * @param selectedCollection - Optional pre-selected collection ID to download
 * @returns Promise that resolves when the download completes
 * @throws Will throw an error if the download or file save operation fails
 */
export const downloadAsl = async (selectedCollection?: string) => {
    const collectionId =
        selectedCollection ||
        (await input({
            message: 'Enter collection ID to download:',
            required: true,
            validate: (page) => (/^\d+$/.test(page) ? true : 'Please enter a valid collection ID'),
        }));

    const s3Client = new S3Client({
        accessKeyId: config.awsAccessKey,
        bucket: config.awsBucket,
        region: config.awsRegion,
        secretAccessKey: config.awsSecretKey,
    });

    const dir = path.join(OUTPUT_DIR, collectionId);

    await mkdir(dir, { recursive: true });
    const outputFile = path.format({ dir, ext: '.json', name: 'book' });

    try {
        const zip = `${collectionId}.json.gz`;

        if (await s3Client.exists(zip)) {
            logger.info(`Decompressing and saving to ${outputFile}`);
            const stats = await s3Client.stat(zip);
            await decompressFromStream(s3Client.file(zip).stream() as unknown as Readable, outputFile);

            console.log(stats);
            return stats;
        } else {
            logger.info(`Downloading uncompressed file to ${outputFile}`);

            const stats = await s3Client.stat(`${collectionId}.json`);
            console.log(stats);

            // For uncompressed files, save directly
            const data = await s3Client.file(`${collectionId}.json`).text();
            logger.info(`Saving file ${outputFile}`);
            await fs.writeFile(outputFile, data);
        }

        logger.info(`File saved successfully: ${outputFile}`);
    } catch (error) {
        logger.error(error, `Error saving file ${outputFile}`);
        throw error;
    }
};
