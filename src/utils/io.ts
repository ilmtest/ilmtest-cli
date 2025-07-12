import type { Readable } from 'node:stream';

import { input } from '@inquirer/prompts';
import { unescapeSpaces } from 'bitaboom';
import { promises as fs } from 'node:fs';
import process from 'node:process';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';

/**
 * Decompresses a gzipped stream and saves it to a file
 * @param sourceStream - The source stream containing compressed data
 * @param outputFilePath - The path where the decompressed file will be saved
 * @returns Promise resolving to the output file path
 */
export const decompressFromStream = async (sourceStream: Readable, outputFilePath: string): Promise<string> => {
    try {
        const destinationStream = await fs.open(outputFilePath, 'w');

        await pipeline(sourceStream, createGunzip(), destinationStream.createWriteStream());

        await destinationStream.close();
        return outputFilePath;
    } catch (error: any) {
        console.error(error.stack);
        throw new Error(`Failed to decompress stream to ${outputFilePath}: ${error}`);
    }
};

export const handlePromptTermination = () => {
    process.on('unhandledRejection', (error) => {
        if (error instanceof Error && error.name === 'ExitPromptError') {
            // ignore
        } else {
            throw error;
        }
    });
};

export const waitForKeyPress = async () => {
    return new Promise<void>((resolve) => {
        process.stdin.setRawMode(true);
        process.stdin.once('data', () => {
            process.stdin.setRawMode(false);
            resolve();
        });
        process.stdin.resume();
    });
};

export const validateJsonFile = async (f: string) => {
    if (!f.endsWith('.json')) {
        return 'The asl must be a .json file';
    }

    if (await Bun.file(f).exists()) {
        return true;
    }

    return 'File does not exist. Please enter a valid file path';
};

export const getFileSystemInput = async (
    {
        message,
        validate,
    }: {
        message: string;
        validate: (value: string) => boolean | Promise<boolean | string> | string;
    } = { message: 'Enter the path to the JSON file:', validate: validateJsonFile },
) => {
    return unescapeSpaces(
        await input({
            message,
            required: true,
            transformer: (val) => unescapeSpaces(val),
            validate: async (input) => {
                const f = unescapeSpaces(input);
                const result = await validate(f);

                return result;
            },
        }),
    );
};

export const getNumericInput = async (message: string, error: string, defaultValue?: string) => {
    return input({
        message,
        ...(defaultValue && { default: defaultValue }),
        required: true,
        validate: async (c) => {
            if (/^\d+$/.test(c)) {
                return true;
            }

            return error;
        },
    });
};
