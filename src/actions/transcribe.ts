import { promises as fs } from 'node:fs';
import path from 'node:path';
import { confirm, select } from '@inquirer/prompts';
import { getMediaTranscript, getMediaUrlForVideoId } from 'baheth-sdk';
import { transcribe } from 'tafrigh';
import { getCollection, getCollections } from '../api/collections.js';
import type { ForeignId, Transcript, TranscriptSeries } from '../types.js';
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

/**
 * Downloads transcripts from the Baheth service for specified foreign IDs
 * @param transcribed - Array of foreign IDs that have been transcribed
 * @param outputDirectory - Directory to save the transcript files
 * @returns Promise resolving to array of foreign IDs with local file paths
 */
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

/**
 * Checks which foreign IDs already have transcripts available in the Baheth service
 * @param fids - Array of foreign IDs to check
 * @returns Promise resolving to array of foreign IDs that have transcripts available
 */
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

/**
 * Downloads YouTube videos for the specified foreign IDs
 * @param fids - Array of foreign IDs representing YouTube video IDs
 * @param outputDirectory - Directory to save the downloaded videos
 * @returns Promise resolving to array of foreign IDs with local video file paths
 */
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

/**
 * Transcribes downloaded video files using AI transcription service
 * @param downloadedVideos - Array of foreign IDs with local video file paths
 * @param outputDirectory - Directory to save the transcript files
 * @param targetCollection - Optional target collection ID for specific processing options
 * @returns Promise resolving to array of foreign IDs with transcript file paths
 */
const transcribeDownloadedVideos = async (
    downloadedVideos: ForeignId[],
    outputDirectory: string,
    targetCollection?: string,
): Promise<ForeignId[]> => {
    const transcribed: ForeignId[] = [];

    logger.info(`Medias to transcribe ${JSON.stringify(downloadedVideos)}`);

    for (const video of downloadedVideos) {
        const mediaPath = path.isAbsolute(video.id) ? video.id : path.join(outputDirectory, video.id);
        const tokens = (
            await transcribe(mediaPath, {
                callbacks: {
                    onPreprocessingFinished: async (filePath) => logger.info(`Pre-formatted ${filePath}`),
                    onPreprocessingStarted: async (filePath) => logger.info(`Pre-formatting ${filePath}`),
                    onTranscriptionFinished: async (transcripts) =>
                        logger.info(`Transcribed ${transcripts.length} chunks`),
                    onTranscriptionProgress: (index) => logger.info(`Transcribed #${index}`),
                    onTranscriptionStarted: async (total) => logger.info(`Starting transcription of ${total} chunks`),
                },
                concurrency: 5,
                retries: 10,
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

/**
 * Gets foreign IDs that don't have corresponding transcript files in the output directory
 * @param fids - Array of foreign IDs to check
 * @param outputDirectory - Directory to check for existing transcript files
 * @returns Promise resolving to array of foreign IDs that need processing
 */
const getRemainingFids = async (fids: ForeignId[], outputDirectory: string) => {
    const filesInOutputDirectory = await fs.readdir(outputDirectory);
    return getUnprocessedVolumes(fids, filesInOutputDirectory);
};

/**
 * Downloads transcripts that are already available in the Baheth service
 * @param fids - Array of foreign IDs to check and download
 * @param outputDirectory - Directory to save the transcript files
 * @returns Promise resolving to array of foreign IDs with downloaded transcript files
 */
const downloadTranscriptsAlreadyTranscribed = async (fids: ForeignId[], outputDirectory: string) => {
    const fidsNotTranscribed = await getRemainingFids(fids, outputDirectory);
    const fidTranscriptsAvailable = await getTranscribedVolumes(fidsNotTranscribed);

    logger.info(`Downloading transcripts ${JSON.stringify(fidTranscriptsAvailable)}`);
    return downloadTranscripts(fidTranscriptsAvailable, outputDirectory);
};

/**
 * Integrates multiple transcript files into a single TranscriptSeries object
 * @param fids - Array of foreign IDs with transcript file paths
 * @param outputDirectory - Directory containing the transcript files
 * @returns Promise resolving to integrated TranscriptSeries object
 */
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

/**
 * Prompts user to select a collection and prepares for transcription
 * @param targetCollection - Optional pre-selected collection ID
 * @param selectedVolume - Optional specific volume number to process
 * @returns Promise resolving to collection ID, foreign IDs, and output directory
 */
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

/**
 * Downloads videos and transcribes them using AI
 * @param fids - Array of foreign IDs to download and transcribe
 * @param outputDirectory - Directory to save files
 * @param targetCollection - Optional target collection for specific processing
 */
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

/**
 * Saves transcript data and handles cleanup operations
 * @param collection - Collection ID
 * @param data - TranscriptSeries data to save
 * @param outputDirectory - Directory containing temporary files
 */
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

/**
 * Main function to transcribe audio/video content using AI
 * Handles the complete workflow from collection selection to final cleanup
 * @param targetCollection - Optional pre-selected collection ID
 * @param selectedVolume - Optional specific volume number to process
 * @returns Promise that resolves when transcription and cleanup are complete
 */
export const transcribeWithAI = async (targetCollection?: string, selectedVolume?: string) => {
    const { collection, fids, outputDirectory } = await getSelectedCollection(
        targetCollection,
        selectedVolume ? parseInt(selectedVolume, 10) : undefined,
    );

    await downloadAndTranscribe(fids, outputDirectory, targetCollection);

    logger.info(`Integrating ${fids.length} volumes from ${outputDirectory}`);
    const result = await integrateTranscriptions(fids, outputDirectory);

    return saveAndCleanup(collection, result, outputDirectory);
};
