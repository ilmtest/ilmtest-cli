import { fetch } from 'bun';
import { Presets, SingleBar } from 'cli-progress';
import fs from 'node:fs';

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

    // Get the total size (may be unknown for streaming media)
    const totalBytes = Number(response.headers.get('content-length')) || 0;
    let downloadedBytes = 0;

    // Initialize progress bar (handle unknown sizes gracefully)
    const bar = new SingleBar(
        { format: 'Downloading | {bar} | {percentage}% | {value}/{total} bytes', hideCursor: true },
        Presets.shades_classic,
    );

    if (totalBytes > 0) {
        bar.start(totalBytes, 0);
    } else {
        logger.warn('Downloading (unknown file size)...');
    }

    const fileStream = fs.createWriteStream(outputPath);
    const reader = response.body.getReader();

    // Process stream: Read, write, and update progress
    const processStream = async () => {
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }

            downloadedBytes += value.byteLength;
            fileStream.write(value); // Directly write chunk to file

            if (totalBytes > 0) {
                bar.update(downloadedBytes);
            }
        }

        fileStream.end();

        if (totalBytes > 0) {
            bar.stop();
        }

        logger.info(`Download complete: ${outputPath}`);
    };

    await processStream();
    return outputPath;
};

export const findFirstSuccessfulUrl = async (urls: string[]): Promise<string> => {
    const abortController = new AbortController();
    const { signal } = abortController;
    const result = await Promise.any(
        urls.map((url) =>
            fetch(url, { signal }) // Attach signal to fetch
                .then((response) => {
                    if (response.ok) {
                        abortController.abort(); // Cancel remaining fetches
                        return url;
                    }
                    throw new Error(`Failed: ${url}`);
                }),
        ),
    );
    return result;
};
