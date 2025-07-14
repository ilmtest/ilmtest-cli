import { confirm, input } from '@inquirer/prompts';
import { magentaBright, yellow } from 'ansis';
import { reduceMultilineBreaksToSingle } from 'bitaboom';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import removeMd from 'remove-markdown';

import { OUTPUT_DIR } from '@/utils/constants.js';
import { getFileSystemInput, getNumericInput } from '@/utils/io.js';

import type { ConversationData } from './types.js';

import { addOrUpdateEntry, type Entry } from '../../api/entries.js';
import logger from '../../utils/logger.js';
import { getConversation, getMessagePairs, getMessages, MODEL_TO_ID } from './matching.js';
import { sanitizeText } from './utils.js';

export const migrateChats = async (inputFile?: string, targetCollection?: string, targetVolume?: string) => {
    const filePath = inputFile || (await getFileSystemInput());
    const conversations: ConversationData[] = await Bun.file(filePath).json();
    const query = sanitizeText(
        await input({
            message: 'Enter your search query:',
            validate: (input: string) => {
                if (input.trim().length === 0) {
                    return 'Please enter a search query';
                }
                return true;
            },
        }),
    );

    const collectionId =
        targetCollection ||
        (await getNumericInput(
            'Enter collection ID associated with chat and part number:',
            'Please enter a valid collection ID',
        ));

    const volume =
        targetVolume || (await getNumericInput('Enter volume number:', 'Please enter a valid volume number'));

    const conversation = await getConversation(conversations, query);

    if (!conversation) {
        return;
    }

    if (volume === '0') {
        const messages = getMessages(conversation)
            .flat()
            .filter((m) => m?.model);

        const dir = path.join(OUTPUT_DIR, collectionId);
        await fs.mkdir(dir, { recursive: true });

        logger.info(`models: ${Array.from(new Set(messages.map((m) => m.model)))}`);

        let data = removeMd(messages.map((m) => m.text).join('\n')).replace(/\\(.)/g, '$1');
        data = messages.map((m) => m.text).join('\n');

        await Bun.file(path.join(dir, 'translation.txt')).write(data);

        return;
    }

    const messagePairs = getMessagePairs(conversation);

    const entries = messagePairs.map(([arabic, translation]) => {
        const entry: Partial<Entry> = {
            arabic: reduceMultilineBreaksToSingle(arabic.text),
            collection: parseInt(collectionId),
            flags: 2,
            translation: removeMd(reduceMultilineBreaksToSingle(translation.text)),
            translator: MODEL_TO_ID[translation.model! as keyof typeof MODEL_TO_ID],
            volume: parseInt(volume),
        };

        return entry;
    });

    if (entries.find((e) => !e.translator)) {
        logger.error(
            entries.find((e) => !e.translator),
            'Invalid Translator',
        );
        return;
    }

    for (const entry of entries) {
        const isConfirmed = await confirm({
            default: true,
            message: `Add:\n\n${magentaBright(entry.arabic)}\n\n${yellow(entry.translation)}`,
        });

        if (isConfirmed) {
            await addOrUpdateEntry(entry);
        }
    }
};
