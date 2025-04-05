import ytdl from '@distube/ytdl-core';

import { downloadFileWithProgress, findBestDownloadUrl } from './network.js';

export const MEDIA_CONTAINER = 'mp4';

export const downloadYouTubeVideo = async (id: string, outputFile: string): Promise<string> => {
    const info = await ytdl.getInfo(`https://youtu.be/${id}`);
    const formats = info.formats.filter(
        (f) => f.container === MEDIA_CONTAINER && f.hasAudio && !f.isHLS && !f.isDashMPD,
    );

    if (formats.length === 0) {
        throw new Error('No suitable mp4 format found');
    }

    const successfulUrl = await findBestDownloadUrl(formats.map((f) => f.url));
    const result = await downloadFileWithProgress(successfulUrl, outputFile);

    return result;
};
