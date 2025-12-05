import path, { basename } from 'node:path';
import { uploadFile } from '@huggingface/hub';
import { Presets, SingleBar } from 'cli-progress';

import logger from './logger.js';

/**
 * Environment variable names for HuggingFace configuration
 */
export const HF_ENV = {
    EMBEDDINGS_REPO: 'HF_EMBEDDINGS_REPO',
    TOKEN: 'HF_TOKEN',
    TRANSLATIONS_REPO: 'HF_TRANSLATIONS_REPO',
} as const;

/**
 * Options for uploading to HuggingFace
 */
interface HuggingFaceUploadOptions {
    /** Path to the local file to upload */
    filePath: string;
    /** Repository ID (e.g., "username/repo-name") */
    repoId: string;
    /** Path/filename in the repository (e.g., "data/file.json") */
    pathInRepo: string;
    /** HuggingFace API token */
    token: string;
    /** Repository type (defaults to "dataset") */
    repoType?: 'dataset' | 'model' | 'space';
}

/**
 * Uploads a file to HuggingFace Hub using the official @huggingface/hub library
 *
 * @param options - Upload configuration options
 * @returns Promise resolving to the file URL on HuggingFace
 * @throws {Error} When upload fails
 *
 * @example
 * ```typescript
 * const url = await uploadToHuggingFace({
 *     filePath: './data.json.zip',
 *     repoId: 'username/my-dataset',
 *     pathInRepo: '123.json.zip',
 *     token: process.env.HF_TOKEN!,
 * });
 * console.log(`Uploaded to: ${url}`);
 * ```
 */
export const uploadToHuggingFace = async ({
    filePath,
    repoId,
    pathInRepo,
    token,
    repoType = 'dataset',
}: HuggingFaceUploadOptions): Promise<string> => {
    const file = Bun.file(filePath);

    if (!(await file.exists())) {
        throw new Error(`File not found: ${filePath}`);
    }

    const repoTypePath = repoType === 'dataset' ? 'datasets' : repoType === 'model' ? 'models' : 'spaces';

    logger.info(`Uploading ${basename(filePath)} to HuggingFace...`);
    logger.info(`Repository: ${repoId}`);
    logger.info(`Path: ${pathInRepo}`);

    // Read file as Blob for the HuggingFace Hub library
    const fileBlob = new Blob([await file.arrayBuffer()]);

    await uploadFile({
        commitTitle: `Upload ${pathInRepo}`,
        credentials: { accessToken: token },
        file: {
            content: fileBlob,
            path: pathInRepo,
        },
        hubUrl: 'https://huggingface.co',
        repo: {
            name: repoId,
            type: repoType,
        },
    });

    const fileUrl = `https://huggingface.co/${repoTypePath}/${repoId}/resolve/main/${pathInRepo}`;
    logger.info(`Upload complete: ${fileUrl}`);

    return fileUrl;
};

/**
 * Gets HuggingFace token from environment, throwing if not set
 */
export const getHuggingFaceToken = (): string => {
    const token = process.env[HF_ENV.TOKEN];
    if (!token) {
        throw new Error(`Missing ${HF_ENV.TOKEN} environment variable. Set it in your .env file.`);
    }
    return token;
};

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
