import config from '@/utils/config.js';
import { decompressFromStream } from '@/utils/io.js';
import logger from '@/utils/logger.js';
import { input } from '@inquirer/prompts';
import { S3Client } from 'bun';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';

export const downloadAsl = async () => {
    const collectionId = await input({
        message: 'Enter collection ID to download:',
        required: true,
        validate: (page) => (/\d+/.test(page) ? true : 'Please enter a valid collection ID'),
    });

    const s3Client = new S3Client({
        accessKeyId: config.awsAccessKey,
        bucket: config.awsBucket,
        region: config.awsRegion,
        secretAccessKey: config.awsSecretKey,
    });

    const outputFile = path.format({ ext: '.json', name: collectionId });

    try {
        if (await s3Client.exists(`${collectionId}.json.gz`)) {
            logger.info(`Decompressing and saving to ${outputFile}`);
            await decompressFromStream(
                s3Client.file(`${collectionId}.json.gz`).stream() as unknown as Readable,
                outputFile,
            );
        } else {
            logger.info(`Downloading uncompressed file to ${outputFile}`);

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
