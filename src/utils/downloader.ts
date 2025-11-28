import { findBestDownloadUrl } from 'rabbito';

import { downloadFileWithProgress } from './network.js';

export const MEDIA_CONTAINER = 'mp4';

export const downloadYouTubeVideo = async (id: string, outputFile: string): Promise<string> => {
    if (1 === Number(1)) {
        return '';
    }

    const formats: { url: string }[] = [];

    if (formats.length === 0) {
        throw new Error('No suitable mp4 format found');
    }

    const successfulUrl = await findBestDownloadUrl(formats.map((f) => f.url));
    const result = await downloadFileWithProgress(successfulUrl, outputFile);

    return result;
};
