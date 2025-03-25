import { GetObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { input } from '@inquirer/prompts';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';

import config from '../utils/config.js';
import { decompressFromStream } from '../utils/io.js';
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

    let file = path.format({ ext: '.json.gz', name: collectionId });
    let isCompressed = true;

    try {
        await s3Client.send(new HeadObjectCommand({ Bucket: config.awsBucket, Key: file }));
    } catch (err: any) {
        logger.warn(err, `Compressed file not found, trying uncompressed version.`);
        file = path.format({ ext: '.json', name: collectionId });
        isCompressed = false;
    }

    logger.info(`Downloading ${config.awsBucket}/${file}`);

    const response = await s3Client.send(new GetObjectCommand({ Bucket: config.awsBucket, Key: file }));
    const outputFile = path.format({ ext: '.json', name: collectionId });

    try {
        if (isCompressed) {
            logger.info(`Decompressing and saving to ${outputFile}`);
            await decompressFromStream(response.Body as Readable, outputFile);
        } else {
            // For uncompressed files, save directly
            const data = await response.Body!.transformToString();
            logger.info(`Saving file ${outputFile}`);
            await fs.writeFile(outputFile, data);
        }

        logger.info(`File saved successfully: ${outputFile}`);
    } catch (error) {
        logger.error(error, `Error saving file ${outputFile}`);
        throw error;
    } finally {
        s3Client.destroy();
    }
};
