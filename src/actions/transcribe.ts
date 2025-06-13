import { confirm, select } from '@inquirer/prompts';
import { getMediaTranscript, getMediaUrlForVideoId } from 'baheth-sdk';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { transcribe } from 'tafrigh';

import type { ForeignId, Transcript, TranscriptSeries } from '../types.js';

import { getCollection, getCollections } from '../api/collections.js';
import { downloadYouTubeVideo } from '../utils/downloader.js';
import {
    getMediasAlreadyDownloaded,
    getMissingMedias,
    getUnprocessedVolumes,
    mapFidToOutputFile,
} from '../utils/fidUtils.js';
import { waitForKeyPress } from '../utils/io.js';
import logger from '../utils/logger.js';
import { uploadAslToS3 } from './uploadAsl.js';

const downloadTranscripts = async (transcribed: ForeignId[], outputDirectory: string): Promise<ForeignId[]> => {
    const result: ForeignId[] = [];

    for (const fid of transcribed) {
        logger.info(`Downloading ${fid.id} from baheth`);
        const transcript = await getMediaTranscript(fid.id);
        const transformed = {
            segments: transcript.segments,
            timestamp: transcript.timestamp,
            urls: [transcript.metadata.srtLink],
            volume: fid.volume,
        } satisfies Transcript;
        const fileName = mapFidToOutputFile(fid, outputDirectory);
        await Bun.file(fileName).write(JSON.stringify(transformed, null, 2));

        logger.info(`Saved ${fid.id} to ${fileName}`);

        result.push({ id: fileName, volume: fid.volume });
    }

    return result;
};

const getTranscribedVolumes = async (fids: ForeignId[]): Promise<ForeignId[]> => {
    const result: ForeignId[] = [];

    for (const fid of fids) {
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
    targetCollection?: string,
): Promise<ForeignId[]> => {
    const transcribed: ForeignId[] = [];

    logger.info(`Medias to transcribe ${JSON.stringify(downloadedVideos)}`);

    for (const video of downloadedVideos) {
        const tokens = (
            await transcribe(path.join(outputDirectory, video.id), {
                callbacks: {
                    onPreprocessingFinished: async (filePath) => logger.info(`Pre-formatted ${filePath}`),
                    onPreprocessingStarted: async (filePath) => logger.info(`Pre-formatting ${filePath}`),
                    onTranscriptionFinished: async (transcripts) =>
                        logger.info(`Transcribed ${transcripts.length} chunks`),
                    onTranscriptionProgress: (index) => logger.info(`Transcribed #${index}`),
                    onTranscriptionStarted: async (total) => logger.info(`Starting transcription of ${total} chunks`),
                },
                concurrency: 5,
                ...(targetCollection && { preprocessOptions: { noiseReduction: null } }),
                splitOptions: { chunkDuration: 300 },
            })
        ).flatMap(({ tokens }) => tokens!.map(({ end, start, text }) => ({ end, start, text })));

        const outputFile = mapFidToOutputFile(video, outputDirectory);
        const result = {
            segments: [
                {
                    end: tokens.at(-1)!.end,
                    start: tokens[0].start,
                    text: tokens.map((t) => t.text).join(' '),
                    tokens,
                },
            ],
            timestamp: new Date(),
            volume: video.volume,
        } satisfies Transcript;
        await Bun.file(outputFile).write(JSON.stringify(result, null, 2));

        if (outputFile) {
            transcribed.push({ id: outputFile, volume: video.volume });
        } else {
            logger.warn(`No output produced for ${video.id}`);
        }
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

    logger.info(`Downloading transcripts ${JSON.stringify(fidTranscriptsAvailable)}`);
    return downloadTranscripts(fidTranscriptsAvailable, outputDirectory);
};

const integrateTranscriptions = async (fids: ForeignId[], outputDirectory: string): Promise<TranscriptSeries> => {
    const result: TranscriptSeries = {
        contractVersion: 'v1.0',
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
        transcripts: [],
    };

    for (const fid of fids) {
        const file = mapFidToOutputFile(fid, outputDirectory);
        const transcript: Transcript = await Bun.file(file).json();
        result.transcripts.push(transcript);
    }

    return result;
};

const getSelectedCollection = async (targetCollection?: string, selectedVolume?: number) => {
    const collections = await getCollections({
        before: '9999',
        library: '62',
        limit: 10,
        ...(targetCollection && { id: targetCollection }),
    });

    const selectedCollection =
        targetCollection ||
        (await select({
            choices: collections.map((c) => ({ description: c.id, name: c.title, value: c.id })),
            default: collections[0].id,
            message: 'Select collection',
        }));

    const [collection] = await Promise.all([
        getCollection(selectedCollection),
        fs.mkdir(selectedCollection, { recursive: true }),
    ]);

    let fids = collection.fid as ForeignId[];

    if (selectedVolume) {
        fids = fids.filter((f) => f.volume === selectedVolume);
    }

    return { collection: selectedCollection, fids, outputDirectory: selectedCollection };
};

const downloadAndTranscribe = async (fids: ForeignId[], outputDirectory: string, targetCollection?: string) => {
    let remainingFids = await getRemainingFids(fids, outputDirectory);

    if (!targetCollection) {
        await downloadTranscriptsAlreadyTranscribed(remainingFids, outputDirectory);
    }

    remainingFids = await getRemainingFids(fids, outputDirectory);
    const remainingMediasNotDownloaded = getMissingMedias(remainingFids, await fs.readdir(outputDirectory));

    await downloadYouTubeVideos(remainingMediasNotDownloaded, outputDirectory);

    if (targetCollection) {
        logger.info('Here is your chance to pre-process the downloaded audio. Press any key to continue...');
        await waitForKeyPress();
    }

    const medias = getMediasAlreadyDownloaded(remainingFids, await fs.readdir(outputDirectory));
    const transcribed = await transcribeDownloadedVideos(medias, outputDirectory, targetCollection);
    logger.info(`Transcribed ${JSON.stringify(transcribed)}`);

    remainingFids = await getRemainingFids(fids, outputDirectory);

    if (remainingFids.length > 0) {
        logger.warn(`Detected some volumes that were not transcribed ${JSON.stringify(remainingFids)}`);
    }
};

const saveAndCleanup = async (collection: string, data: TranscriptSeries, outputDirectory: string) => {
    const outputFile = path.format({ ext: '.json', name: outputDirectory });
    logger.info(`Writing to ${outputFile}`);

    const outputFileObj = Bun.file(outputFile);
    await outputFileObj.write(JSON.stringify(data, null, 2));

    const shouldUpload = await confirm({ message: `Do you want to upload to S3?` });

    if (shouldUpload) {
        await uploadAslToS3(collection, outputFile);
        await outputFileObj.delete();
    }

    const deleteOutputFolder = await confirm({ message: `Do we you want to delete ${outputDirectory}` });

    if (deleteOutputFolder) {
        await fs.rm(outputDirectory, { recursive: true });
    }
};

export const transcribeWithAI = async (targetCollection?: string, selectedVolume?: string) => {
    const { collection, fids, outputDirectory } = await getSelectedCollection(
        targetCollection,
        selectedVolume ? parseInt(selectedVolume) : undefined,
    );

    await downloadAndTranscribe(fids, outputDirectory, targetCollection);

    logger.info(`Integrating ${fids.length} volumes from ${outputDirectory}`);
    const result = await integrateTranscriptions(fids, outputDirectory);

    return saveAndCleanup(collection, result, outputDirectory);
};
