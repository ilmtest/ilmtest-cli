import { Presets, SingleBar } from 'cli-progress';

import logger from './logger.js';

const SAMPLE_BYTES = 256_000; // bytes to download to test speed (~256 KB)

const measureDownloadSpeed = async (url: string, signal: AbortSignal): Promise<{ speed: number; url: string }> => {
    const start = performance.now();
    const response = await fetch(url, { signal });

    if (!response.ok || !response.body) throw new Error(`Failed: ${url}`);

    const reader = response.body.getReader();
    let totalBytes = 0;

    while (totalBytes < SAMPLE_BYTES) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        totalBytes += value.byteLength;
    }

    const duration = (performance.now() - start) / 1000; // seconds
    const speed = totalBytes / duration; // bytes/sec
    return { speed, url };
};

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

export const findBestDownloadUrl = async (urls: string[]): Promise<string> => {
    const controllers = urls.map(() => new AbortController());

    const speedTests = urls.map((url, index) => {
        const signal = controllers[index].signal;
        return measureDownloadSpeed(url, signal)
            .then((result) => {
                // Abort other fetches on first successful result
                controllers.forEach((controller, i) => {
                    if (i !== index) controller.abort();
                });
                return result;
            })
            .catch((err) => {
                logger.warn(`Error testing ${url}: ${err.message}`);
                return null; // Mark this one as failed
            });
    });

    const result = await Promise.any(
        speedTests.map((p) =>
            p.then((res) => {
                if (!res) throw new Error('Failed'); // Force rejection for nulls
                return res;
            }),
        ),
    ).catch(() => {
        throw new Error('All speed tests failed');
    });

    return result.url;
};
