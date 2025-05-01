import { Presets, SingleBar } from 'cli-progress';

import logger from './logger.js';

/**
 * Downloads a streaming file (e.g., from YouTube) and saves it.
 * Works with chunked transfer encoding.
 * @param url - The streaming URL to download.
 * @param outputPath - Where to save the downloaded file.
 */
export const downloadFileWithProgress = async (url: string, outputPath: string): Promise<string> => {
    const response = await fetch(url);

    if (!response.ok || !response.body) {
        throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    }

    const totalBytes = Number(response.headers.get('content-length')) || 0;
    let downloadedBytes = 0;

    const bar = new SingleBar(
        { format: 'Downloading | {bar} | {percentage}% | {value}/{total} bytes', hideCursor: true },
        Presets.shades_classic,
    );

    if (totalBytes > 0) {
        bar.start(totalBytes, 0);
    } else {
        logger.warn('Downloading (unknown file size)...');
    }

    const writer = Bun.file(outputPath).writer();
    const reader = response.body.getReader();

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        await writer.write(value); // No getWriter — write directly
        downloadedBytes += value.byteLength;

        if (totalBytes > 0) {
            bar.update(downloadedBytes);
        }
    }

    await writer.end();

    if (totalBytes > 0) {
        bar.stop();
    }

    logger.info(`Download complete: ${outputPath}`);
    return outputPath;
};
