import { select } from '@inquirer/prompts';

import type { ConversationData } from './types.js';

import logger from '../../utils/logger.js';
import { getArabicScore } from '../../utils/textUtils.js';
import { getTextMessages, searchInConversation } from './utils.js';

type BasicMessage = {
    arabicScore: number;
    model?: string;
    text: string;
    timestamp: number;
};

export const MODEL_TO_ID = {
    'gpt-4-5': 867,
    'gpt-4o': 619,
    o3: 870,
    'o3-mini-high': 875,
} as const;

const MINIMUM_ARABIC_SCORE = 0.92;

const MIN_TRANSLATION_ARABIC_SCORE = 0.05;

export const validatePair = (arabic: BasicMessage, translation: BasicMessage) => {
    return (
        arabic.arabicScore > MINIMUM_ARABIC_SCORE &&
        translation.arabicScore < MIN_TRANSLATION_ARABIC_SCORE &&
        !arabic.model &&
        translation.model &&
        arabic.text &&
        translation.text
    );
};

export const getMessages = (conversation: ConversationData) => {
    const messages: BasicMessage[] = getTextMessages(conversation)
        .map((m) => {
            const text = m.content.parts.join('\n').trim();

            return {
                arabicScore: getArabicScore(text),
                model: m.metadata.model_slug,
                text,
                timestamp: m.create_time,
            };
        })
        .map((m) => {
            if (!m.model) {
                const text = m.text
                    .split('\n')
                    .filter((line) => getArabicScore(line) > MIN_TRANSLATION_ARABIC_SCORE)
                    .filter(Boolean)
                    .join('\n');

                return { ...m, arabicScore: getArabicScore(text), text };
            }

            return m;
        })
        .sort((a, b) => a.timestamp - b.timestamp);

    const result = messages
        .filter((m, i, arr) => {
            return i === 0 || m.model !== arr[i - 1].model;
        })
        .flatMap((m, i, arr) => {
            if (i % 2 === 0) {
                return [[m, arr[i + 1]]];
            }

            return [];
        });

    return result;
};

// Handle user selection when multiple conversation match
export const handleMultipleMatches = async (matches: ConversationData[]) => {
    const choices = matches.map((match) => ({
        name: match.title,
        value: match,
    }));

    return await select({
        choices,
        message: 'Multiple files found. Please select one:',
    });
};

export const getConversation = async (conversations: ConversationData[], query: string) => {
    logger.info(`\n🔎 Searching for: "${query}"`);

    const matches = conversations.filter((c) => searchInConversation(c, query));

    if (matches.length === 0) {
        logger.info('❌ No conversations found containing the search query.');
        return;
    }

    const conversation = matches.length === 1 ? matches[0] : await handleMultipleMatches(matches);

    return conversation;
};

export const getMessagePairs = (conversation: ConversationData) => {
    const messagePairs = getMessages(conversation);

    if (messagePairs.find(([arabic, translation]) => !validatePair(arabic, translation))) {
        logger.error(
            messagePairs.find(([arabic, translation]) => !validatePair(arabic, translation)),
            'Mismatched',
        );

        return [];
    }

    return messagePairs;
};
