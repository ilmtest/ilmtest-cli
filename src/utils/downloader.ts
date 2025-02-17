import ytdl from '@distube/ytdl-core';

import { downloadFileWithProgress, findFirstSuccessfulUrl } from './network.js';

export const downloadYouTubeVideo = async (id: string, outputFile: string): Promise<string> => {
    const videoUrl = `https://youtu.be/${id}`;
    const info = await ytdl.getInfo(videoUrl);
    const formats = info.formats.filter((f) => f.container === 'mp4' && f.hasAudio && !f.isHLS && !f.isDashMPD);

    if (formats.length === 0) {
        throw new Error('No suitable mp4 format found');
    }

    const successfulUrl = await findFirstSuccessfulUrl(formats.map((f) => f.url));
    const result = await downloadFileWithProgress(successfulUrl, outputFile);

    return result;
};
