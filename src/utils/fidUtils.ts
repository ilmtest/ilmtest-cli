import path from 'node:path';

import { ForeignId } from '../types.js';
import { MEDIA_CONTAINER } from './downloader.js';

export const mapFidToOutputFile = (fid: ForeignId, outputDirectory = '', ext = '.json') => {
    return path.format({ dir: outputDirectory, ext, name: fid.volume.toString() });
};

export const getUnprocessedVolumes = (fids: ForeignId[], files: string[]): ForeignId[] => {
    return fids.filter((fid) => {
        const volumeFile = mapFidToOutputFile(fid);
        return !files.includes(volumeFile);
    });
};

const getMediaDownloadedForVolume = (fid: ForeignId, files: string[]): string | undefined => {
    const potentialMatches = ['.wav', '.mp3', `.${MEDIA_CONTAINER}`].map((ext) => mapFidToOutputFile(fid, '', ext));
    return potentialMatches.find((file) => files.includes(file));
};

export const getMediasAlreadyDownloaded = (fids: ForeignId[], files: string[]): ForeignId[] => {
    const downloadedFids = fids
        .map((fid) => ({ id: getMediaDownloadedForVolume(fid, files), volume: fid.volume }))
        .filter((fid) => fid.id);

    return downloadedFids as ForeignId[];
};

export const getMissingMedias = (fids: ForeignId[], files: string[]): ForeignId[] => {
    return fids.filter((fid) => !getMediaDownloadedForVolume(fid, files));
};
