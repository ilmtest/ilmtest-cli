import { promises as fs } from 'node:fs';
import process from 'node:process';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import { input } from '@inquirer/prompts';
import { unescapeSpaces } from 'bitaboom';

/**
 * Decompresses a gzipped stream and saves it to a file
 *
 * @param sourceStream - The source stream containing compressed data
 * @param outputFilePath - The path where the decompressed file will be saved
 * @returns Promise resolving to the output file path
 * @throws {Error} When decompression fails
 *
 * @example
 * ```typescript
 * import { createReadStream } from 'fs';
 *
 * const sourceStream = createReadStream('compressed.gz');
 * const outputPath = await decompressFromStream(sourceStream, './output.txt');
 * console.log(`File decompressed to: ${outputPath}`);
 * ```
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

/**
 * Sets up handlers for prompt termination events
 * Currently commented out but available for handling unhandled promise rejections
 *
 * @example
 * ```typescript
 * handlePromptTermination();
 * // Now the process will handle prompt exit errors gracefully
 * ```
 */
export const handlePromptTermination = () => {
    /*process.on('unhandledRejection', (error) => {
        if (error instanceof Error && error.name === 'ExitPromptError') {
            // ignore
        } else {
            throw error;
        }
    }); */
};

/**
 * Waits for a single key press from the user
 *
 * @returns Promise that resolves when a key is pressed
 *
 * @example
 * ```typescript
 * console.log('Press any key to continue...');
 * await waitForKeyPress();
 * console.log('Continuing...');
 * ```
 */
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

/**
 * Validates that a file path points to an existing JSON file
 *
 * @param f - The file path to validate
 * @returns True if valid, error message string if invalid
 *
 * @example
 * ```typescript
 * const result = await validateJsonFile('./data.json');
 * if (result === true) {
 *     console.log('Valid JSON file');
 * } else {
 *     console.log('Error:', result);
 * }
 * ```
 */
export const validateJsonFile = async (f: string) => {
    if (!f.endsWith('.json')) {
        return 'The asl must be a .json file';
    }

    if (await Bun.file(f).exists()) {
        return true;
    }

    return 'File does not exist. Please enter a valid file path';
};

/**
 * Configuration options for file system input prompt
 */
interface FileSystemInputOptions {
    /** Default value for the input */
    defaultValue?: string;
    /** Message to display to the user */
    message: string;
    /** Whether the input is required */
    required?: boolean;
    /** Validation function for the input */
    validate: (value: string) => boolean | Promise<boolean | string> | string;
}

/**
 * Prompts user for file system input with validation
 *
 * @param options - Configuration options for the input prompt
 * @returns Promise resolving to the user's input (with spaces unescaped)
 *
 * @example
 * ```typescript
 * const filePath = await getFileSystemInput({
 *     message: 'Enter JSON file path:',
 *     validate: validateJsonFile,
 *     defaultValue: './config.json'
 * });
 * ```
 */
export const getFileSystemInput = async (
    { defaultValue, message, required = true, validate }: FileSystemInputOptions = {
        message: 'Enter the path to the JSON file:',
        validate: validateJsonFile,
    },
) => {
    return unescapeSpaces(
        await input({
            default: defaultValue,
            message,
            required,
            transformer: (val) => unescapeSpaces(val),
            validate: async (input) => {
                const f = unescapeSpaces(input);
                const result = await validate(f);

                return result;
            },
        }),
    );
};

/**
 * Prompts user for numeric input with validation
 *
 * @param message - Message to display to the user
 * @param error - Error message to show for invalid input
 * @param defaultValue - Optional default value
 * @returns Promise resolving to the user's numeric input as a string
 *
 * @example
 * ```typescript
 * const count = await getNumericInput(
 *     'How many items?',
 *     'Please enter a valid number',
 *     '10'
 * );
 * const numericCount = parseInt(count, 10);
 * ```
 */
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
