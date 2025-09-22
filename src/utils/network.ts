import path from 'node:path';
import { Presets, SingleBar } from 'cli-progress';

import logger from './logger.js';

/**
 * Downloads a streaming file (e.g., from YouTube) and saves it with progress tracking.
 * Works with chunked transfer encoding and handles unknown file sizes.
 *
 * @param url - The streaming URL to download
 * @param outputPath - Where to save the downloaded file
 * @returns Promise resolving to the output file path
 * @throws {Error} When the download fails
 *
 * @example
 * ```typescript
 * try {
 *     const filePath = await downloadFileWithProgress(
 *         'https://example.com/video.mp4',
 *         './downloads/video.mp4'
 *     );
 *     console.log(`Downloaded to: ${filePath}`);
 * } catch (error) {
 *     console.error('Download failed:', error.message);
 * }
 * ```
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
        if (done) {
            break;
        }

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

/**
 * Loads data from a cached JSON file or downloads it fresh if not available.
 * Provides caching mechanism to avoid repeated downloads.
 *
 * @template T - The type of data being loaded/downloaded
 * @param fileName - Name of the file (without extension) for caching
 * @param getter - Function that fetches the data when not cached
 * @param dir - Directory where the cached file should be stored
 * @param forceRefresh - If true, always download fresh data (defaults to false)
 * @returns Promise resolving to the loaded or downloaded data
 *
 * @example
 * ```typescript
 * interface ApiData {
 *     items: string[];
 *     count: number;
 * }
 *
 * const data = await loadOrDownload<ApiData>(
 *     'api-data',
 *     () => fetch('/api/data').then(r => r.json()),
 *     './cache',
 *     false
 * );
 * ```
 */
export const loadOrDownload = async <T>(
    fileName: string,
    getter: () => Promise<T>,
    dir: string,
    forceRefresh = false,
): Promise<T> => {
    const file = Bun.file(path.format({ dir, ext: '.json', name: fileName }));

    if (!forceRefresh && (await file.exists())) {
        return file.json();
    } else {
        logger.info(`Downloading ${fileName}`);
        const data = await getter();

        if (!forceRefresh) {
            logger.info(`Saving ${fileName}`);
            await file.write(JSON.stringify(data, null, 2));
        }

        return data;
    }
};
