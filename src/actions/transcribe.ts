import { select } from '@inquirer/prompts';
import { type Transcript as BahethTranscript, getMediaTranscript, getMediaUrlForVideoId } from 'baheth-sdk';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { type Transcript as TafrighTranscript, transcribe } from 'tafrigh';

import { getCollection, getCollections } from '../api/collections.js';
import { ForeignId, Transcript } from '../types.js';
import { downloadYouTubeVideo } from '../utils/downloader.js';
import {
    getMediasAlreadyDownloaded,
    getMissingMedias,
    getUnprocessedVolumes,
    mapFidToOutputFile,
} from '../utils/fidUtils.js';
import logger from '../utils/logger.js';
import {
    mapBahethSegments,
    mapBahethTranscript,
    mapSegmentsToTranscript,
    mapTafrighSegments,
} from '../utils/mapping.js';

const downloadTranscripts = async (transcribed: ForeignId[], outputDirectory: string): Promise<ForeignId[]> => {
    const result: ForeignId[] = [];

    for (const fid of transcribed) {
        logger.info(`Downloading ${fid.id} from baheth`);
        const transcript = await getMediaTranscript(fid.id);
        const fileName = mapFidToOutputFile(fid, outputDirectory);
        await fs.writeFile(fileName, JSON.stringify(transcript));

        logger.info(`Saved ${fid.id} to ${fileName}`);

        result.push({ id: fileName, volume: fid.volume });
    }

    return result;
};

const getTranscribedVolumes = async (fids: ForeignId[]): Promise<ForeignId[]> => {
    const result: ForeignId[] = [];

    for (let fid of fids) {
        logger.info(`Checking for existing transcription from baheth: ${fid.id}`);
        const url = await getMediaUrlForVideoId(fid.id);

        if (url) {
            logger.info(`Found transcription: ${url}`);
            result.push({ id: url, volume: fid.volume });
        }
    }

    return result;
};

const downloadYouTubeVideos = async (fids: ForeignId[], outputDirectory: string): Promise<ForeignId[]> => {
    const result: ForeignId[] = [];

    for (const fid of fids) {
        const outputFile = await downloadYouTubeVideo(
            fid.id,
            path.format({ dir: outputDirectory, ext: '.mp4', name: fid.volume.toString() }),
        );

        result.push({ id: outputFile, volume: fid.volume });
    }

    return result;
};

const transcribeDownloadedVideos = async (
    downloadedVideos: ForeignId[],
    outputDirectory: string,
): Promise<ForeignId[]> => {
    const transcribed: ForeignId[] = [];

    for (const video of downloadedVideos) {
        const outputFile = await transcribe(video.id, {
            callbacks: {
                onPreprocessingFinished: async (filePath) => logger.info(`Pre-formatted ${filePath}`),
                onPreprocessingStarted: async (filePath) => logger.info(`Pre-formatting ${filePath}`),
                onTranscriptionFinished: async (transcripts) => logger.info(`Transcribed ${transcripts.length} chunks`),
                onTranscriptionProgress: (index) => logger.info(`Transcribed #${index}`),
                onTranscriptionStarted: async (total) => logger.info(`Starting transcription of ${total} chunks`),
            },
            concurrency: 5,
            lineBreakSecondsThreshold: 2,
            outputOptions: { includeTokens: true, outputFile: mapFidToOutputFile(video, outputDirectory) },
            splitOptions: { chunkDuration: 300 },
        });

        transcribed.push({ id: outputFile, volume: video.volume });
    }

    return transcribed;
};

const getRemainingFids = async (fids: ForeignId[], outputDirectory: string) => {
    const filesInOutputDirectory = await fs.readdir(outputDirectory);
    return getUnprocessedVolumes(fids, filesInOutputDirectory);
};

const downloadTranscriptsAlreadyTranscribed = async (fids: ForeignId[], outputDirectory: string) => {
    const fidsNotTranscribed = await getRemainingFids(fids, outputDirectory);
    const fidTranscriptsAvailable = await getTranscribedVolumes(fidsNotTranscribed);
    return downloadTranscripts(fidTranscriptsAvailable, outputDirectory);
};

const integrateTranscriptions = async (fids: ForeignId[], outputDirectory: string): Promise<Transcript> => {
    const result: Transcript = { parts: [], timestamp: new Date(), urls: [] };

    for (const fid of fids) {
        const file = mapFidToOutputFile(fid, outputDirectory);
        const { timestamp, transcripts, url } = mapSegmentsToTranscript(JSON.parse(await fs.readFile(file, 'utf-8')));

        result.parts.push({ part: fid.volume, timestamp: timestamp || new Date(), transcripts });

        if (url) {
            result.urls.push(url);
        }
    }

    return result;
};

export const transcribeWithAI = async () => {
    const collections = await getCollections({ before: '9999', library: '62', limit: 10 });
    const selectedCollection = await select({
        choices: collections.map((c) => ({ description: c.id, name: c.title, value: c.id })),
        default: collections[0].id,
        message: 'Select collection',
    });
    const outputDirectory = selectedCollection;

    const [collection] = await Promise.all([
        getCollection(selectedCollection),
        fs.mkdir(outputDirectory, { recursive: true }),
    ]);

    const fids = collection.fid as ForeignId[];
    await downloadTranscriptsAlreadyTranscribed(fids, outputDirectory);
    let remainingFids = await getRemainingFids(fids, outputDirectory);
    const remainingMediasNotDownloaded = getMissingMedias(remainingFids, await fs.readdir(outputDirectory));
    await downloadYouTubeVideos(remainingMediasNotDownloaded, outputDirectory);

    const medias = getMediasAlreadyDownloaded(remainingFids, await fs.readdir(outputDirectory));
    await transcribeDownloadedVideos(medias, outputDirectory);

    remainingFids = await getRemainingFids(fids, outputDirectory);

    if (remainingFids.length > 0) {
        logger.warn(`Detected some volumes that were not transcribed ${JSON.stringify(remainingFids)}`);
    }

    const result = await integrateTranscriptions(fids, outputDirectory);
    return fs.writeFile(path.format({ ext: '.json', name: selectedCollection }), JSON.stringify(result, null, 2));
};
