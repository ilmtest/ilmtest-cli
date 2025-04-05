import { getCollection, getCollections } from '@/api/collections.js';
import { ForeignId, Transcript } from '@/types.js';
import { downloadYouTubeVideo } from '@/utils/downloader.js';
import {
    getMediasAlreadyDownloaded,
    getMissingMedias,
    getUnprocessedVolumes,
    mapFidToOutputFile,
} from '@/utils/fidUtils.js';
import logger from '@/utils/logger.js';
import { mapSegmentsToTranscript } from '@/utils/mapping.js';
import { confirm, select } from '@inquirer/prompts';
import { getMediaTranscript, getMediaUrlForVideoId } from 'baheth-sdk';
import { file } from 'bun';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { transcribe } from 'tafrigh';

const downloadTranscripts = async (transcribed: ForeignId[], outputDirectory: string): Promise<ForeignId[]> => {
    const result: ForeignId[] = [];

    for (const fid of transcribed) {
        logger.info(`Downloading ${fid.id} from baheth`);
        const transcript = await getMediaTranscript(fid.id);
        const fileName = mapFidToOutputFile(fid, outputDirectory);
        await file(fileName).write(JSON.stringify(transcript));

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
): Promise<ForeignId[]> => {
    const transcribed: ForeignId[] = [];

    logger.info(`Medias to transcribe ${JSON.stringify(downloadedVideos)}`);

    for (const video of downloadedVideos) {
        const outputFile = await transcribe(path.join(outputDirectory, video.id), {
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

const getSelectedCollection = async () => {
    const collections = await getCollections({ before: '9999', library: '62', limit: 10 });
    const selectedCollection = await select({
        choices: collections.map((c) => ({ description: c.id, name: c.title, value: c.id })),
        default: collections[0].id,
        message: 'Select collection',
    });

    const [collection] = await Promise.all([
        getCollection(selectedCollection),
        fs.mkdir(selectedCollection, { recursive: true }),
    ]);

    return { fids: collection.fid as ForeignId[], outputDirectory: selectedCollection };
};

const downloadAndTranscribe = async (fids: ForeignId[], outputDirectory: string) => {
    await downloadTranscriptsAlreadyTranscribed(fids, outputDirectory); // update logic to only check for remaining ones not already downloaded
    let remainingFids = await getRemainingFids(fids, outputDirectory);
    const remainingMediasNotDownloaded = getMissingMedias(remainingFids, await fs.readdir(outputDirectory));
    await downloadYouTubeVideos(remainingMediasNotDownloaded, outputDirectory);

    const medias = getMediasAlreadyDownloaded(remainingFids, await fs.readdir(outputDirectory));
    const transcribed = await transcribeDownloadedVideos(medias, outputDirectory);
    logger.info(`Transcribed ${JSON.stringify(transcribed)}`);

    remainingFids = await getRemainingFids(fids, outputDirectory);

    if (remainingFids.length > 0) {
        logger.warn(`Detected some volumes that were not transcribed ${JSON.stringify(remainingFids)}`);
    }
};

const saveAndCleanup = async (data: Transcript, outputDirectory: string) => {
    const outputFile = path.format({ ext: '.json', name: outputDirectory });
    logger.info(`Writing to ${outputFile}`);
    await file(outputFile).write(JSON.stringify(data, null, 2));

    const deleteOutputFolder = await confirm({ message: `Do we you want to delete ${outputDirectory}` });

    if (deleteOutputFolder) {
        await fs.rm(outputDirectory, { recursive: true });
    }
};

export const transcribeWithAI = async () => {
    const { fids, outputDirectory } = await getSelectedCollection();

    await downloadAndTranscribe(fids, outputDirectory);

    logger.info(`Integrating ${fids.length} volumes from ${outputDirectory}`);
    const result = await integrateTranscriptions(fids, outputDirectory);

    return saveAndCleanup(result, outputDirectory);
};
