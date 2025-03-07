import { promises as fs } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';

export const compressFile = async (filePath: string) => {
    const gzippedFilePath = `${filePath}.gz`;

    const sourceStream = await fs.open(filePath, 'r');
    const destinationStream = await fs.open(gzippedFilePath, 'w');

    await pipeline(sourceStream.createReadStream(), createGzip(), destinationStream.createWriteStream());

    await sourceStream.close();
    await destinationStream.close();

    return gzippedFilePath;
};
