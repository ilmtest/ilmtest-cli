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

export const getRemainingMedia = (unprocessed: ForeignId[], transcribed: ForeignId[]): ForeignId[] => {
    return unprocessed.filter((f) => !transcribed.some((t) => t.id === f.id));
};

const isMediaForVolumeDownloaded = (fid: ForeignId, files: string[]): boolean => {
    const wavFile = mapFidToOutputFile(fid, '', '.wav');
    const mp4File = mapFidToOutputFile(fid, '', `.${MEDIA_CONTAINER}`);

    return files.includes(wavFile) || files.includes(mp4File);
};

export const getMediasAlreadyDownloaded = (fids: ForeignId[], files: string[]): ForeignId[] => {
    return fids.filter((fid) => isMediaForVolumeDownloaded(fid, files));
};

export const getMissingMedias = (fids: ForeignId[], files: string[]): ForeignId[] => {
    return fids.filter((fid) => !isMediaForVolumeDownloaded(fid, files));
};
