import path from 'node:path';

import type { ForeignId } from '../types.js';

import { MEDIA_CONTAINER } from './downloader.js';

/**
 * Maps a foreign ID to an output file path
 *
 * @param fid - The foreign ID object containing volume information
 * @param outputDirectory - The output directory path (defaults to empty string)
 * @param ext - The file extension (defaults to '.json')
 * @returns The formatted file path
 *
 * @example
 * ```typescript
 * const fid = { volume: 123 };
 * const filePath = mapFidToOutputFile(fid, '/output', '.json');
 * // Result: '/output/123.json'
 * ```
 */
export const mapFidToOutputFile = (fid: ForeignId, outputDirectory = '', ext = '.json') => {
    return path.format({ dir: outputDirectory, ext, name: fid.volume.toString() });
};

/**
 * Filters foreign IDs to find volumes that haven't been processed yet
 *
 * @param fids - Array of foreign ID objects
 * @param files - Array of existing file names
 * @returns Array of foreign IDs that don't have corresponding output files
 *
 * @example
 * ```typescript
 * const fids = [{ volume: 1 }, { volume: 2 }, { volume: 3 }];
 * const existingFiles = ['1.json', '3.json'];
 * const unprocessed = getUnprocessedVolumes(fids, existingFiles);
 * // Result: [{ volume: 2 }]
 * ```
 */
export const getUnprocessedVolumes = (fids: ForeignId[], files: string[]): ForeignId[] => {
    return fids.filter((fid) => {
        const volumeFile = mapFidToOutputFile(fid);
        return !files.includes(volumeFile);
    });
};

/**
 * Checks if media has been downloaded for a specific volume
 *
 * @param fid - The foreign ID to check
 * @param files - Array of existing file names
 * @returns The filename of the downloaded media, or undefined if not found
 *
 * @internal
 */
const getMediaDownloadedForVolume = (fid: ForeignId, files: string[]): string | undefined => {
    const potentialMatches = ['.wav', '.mp3', `.${MEDIA_CONTAINER}`].map((ext) => mapFidToOutputFile(fid, '', ext));
    return potentialMatches.find((file) => files.includes(file));
};

/**
 * Finds foreign IDs that already have downloaded media files
 *
 * @param fids - Array of foreign ID objects to check
 * @param files - Array of existing file names
 * @returns Array of foreign IDs that have corresponding media files
 *
 * @example
 * ```typescript
 * const fids = [{ volume: 1 }, { volume: 2 }];
 * const files = ['1.mp3', '3.wav'];
 * const downloaded = getMediasAlreadyDownloaded(fids, files);
 * // Result: [{ volume: 1 }]
 * ```
 */
export const getMediasAlreadyDownloaded = (fids: ForeignId[], files: string[]): ForeignId[] => {
    const downloadedFids = fids
        .map((fid) => ({ id: getMediaDownloadedForVolume(fid, files), volume: fid.volume }))
        .filter((fid) => fid.id);

    return downloadedFids as ForeignId[];
};

/**
 * Finds foreign IDs that are missing their media files
 *
 * @param fids - Array of foreign ID objects to check
 * @param files - Array of existing file names
 * @returns Array of foreign IDs that don't have corresponding media files
 *
 * @example
 * ```typescript
 * const fids = [{ volume: 1 }, { volume: 2 }];
 * const files = ['1.mp3'];
 * const missing = getMissingMedias(fids, files);
 * // Result: [{ volume: 2 }]
 * ```
 */
export const getMissingMedias = (fids: ForeignId[], files: string[]): ForeignId[] => {
    return fids.filter((fid) => !getMediaDownloadedForVolume(fid, files));
};
