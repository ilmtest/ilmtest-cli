import { spawn } from 'node:child_process';
import { lookpath } from 'lookpath';
import logger from './logger.js';

export const MEDIA_CONTAINER = 'mp4';

export const downloadYouTubeVideo = async (id: string, outputFile: string): Promise<string> => {
    const ytDlpPath = await lookpath('yt-dlp');

    if (!ytDlpPath) {
        throw new Error('yt-dlp is not installed. Please install it to download videos.');
    }

    logger.info(`Downloading video ${id} to ${outputFile} using yt-dlp...`);

    return new Promise((resolve, reject) => {
        const process = spawn(ytDlpPath, [
            '-f',
            `bestvideo[ext=${MEDIA_CONTAINER}]+bestaudio[ext=m4a]/best[ext=${MEDIA_CONTAINER}]/best`,
            '-o',
            outputFile,
            `https://www.youtube.com/watch?v=${id}`,
        ]);

        process.stdout.on('data', (data) => {
            const output = data.toString().trim();
            if (output) {
                logger.info(`[yt-dlp] ${output}`);
            }
        });

        process.stderr.on('data', (data) => {
            const output = data.toString().trim();
            if (output) {
                logger.warn(`[yt-dlp] ${output}`);
            }
        });

        process.on('close', (code) => {
            if (code === 0) {
                logger.info(`Successfully downloaded video ${id}`);
                resolve(outputFile);
            } else {
                reject(new Error(`yt-dlp exited with code ${code}`));
            }
        });

        process.on('error', (err) => {
            reject(err);
        });
    });
};
