import { promises as fs } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip, createGzip } from 'node:zlib';

export const compressFile = async (filePath: string, outputFilePath: string) => {
    const sourceStream = await fs.open(filePath, 'r');
    const destinationStream = await fs.open(outputFilePath, 'w');

    await pipeline(sourceStream.createReadStream(), createGzip(), destinationStream.createWriteStream());

    await sourceStream.close();
    await destinationStream.close();

    return outputFilePath;
};

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
