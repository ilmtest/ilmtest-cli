import type { Readable } from 'node:stream';

import { promises as fs } from 'node:fs';
import process from 'node:process';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';

/**
 * Decompresses a gzipped stream and saves it to a file
 * @param sourceStream - The source stream containing compressed data
 * @param outputFilePath - The path where the decompressed file will be saved
 * @returns Promise resolving to the output file path
 */
export const decompressFromStream = async (sourceStream: Readable, outputFilePath: string): Promise<string> => {
    try {
        const destinationStream = await fs.open(outputFilePath, 'w');

        await pipeline(sourceStream, createGunzip(), destinationStream.createWriteStream());

        await destinationStream.close();
        return outputFilePath;
    } catch (error) {
        throw new Error(`Failed to decompress stream to ${outputFilePath}: ${error}`);
    }
};

export const waitForKeyPress = async () => {
    return new Promise<void>((resolve) => {
        process.stdin.setRawMode(true);
        process.stdin.once('data', () => {
            process.stdin.setRawMode(false);
            resolve();
        });
        process.stdin.resume();
    });
};
