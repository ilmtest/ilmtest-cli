import path from 'node:path';
import { GoogleGenAI } from '@google/genai';
import Conf from 'conf';
import { ApiKeyManager, LlmClient, LoadBalancingStrategy } from 'kukamba';
import type { Entry } from '@/api/entries.js';
import type { Config, Excerpts } from '@/types.js';
import { OUTPUT_DIR } from '@/utils/constants.js';
import logger from '@/utils/logger.js';

const TRANSLATE_PROMPT = [
    `You are a professional Arabic to English translator who specializes in Islāmic content.`,
    `You will be translating from the book: {{book}}.`,
    'Translate the following Arabic text into English with the highest level of accuracy preferring literal translations except when the context fits to translate by meaning.',
    'Carefully analyze the context to ensure the correct usage of Islamic technical terminology.',
    'Preserve full chains of narration and use ALA-LC transliteration only on the names of the narrators in the chain but not the textual content. "حَدَّثَنَا مُحَمَّدُ" would translate to "Muḥammad narrated to us". Translate chapter headings, poetry and verses as well.',
    'Translate "God" as Allah unless the Arabic is actually refering to an ilāh. Whenever صلى الله عليه وسلم is used translate it with ﷺ. There should be no Arabic characters in your response other than this one.',
    'Respond only in plain-text, no markdown or formatting. Keep the IDs (B1, C2, N33, P44, P44a, etc.) that appear in the beginning of each segment. Do NOT attempt to correct the numeric prefixes if they seem out of order or assume continuity from one to another.',
    'Revise your translation THREE times before sending it back:',
    'The first pass: Verify all translations are aligned with matching Arabic numeric markers.',
    'The second pass: The translations are accurate based on the overall context.',
    'The third pass: Any transliterations used are accurate.',
    'CRITICAL: Never format chapter headings into all uppercase.',
].join('\n');

const MODEL = 'gemini-2.5-flash';
const TRANSLATOR_ID = 891;

// Token estimation: ~4 chars per token for Arabic, keep under 6000 tokens per batch for safety
const MAX_TOKENS_PER_BATCH = 6000;
const CHARS_PER_TOKEN = 4;
const MAX_CHARS_PER_BATCH = MAX_TOKENS_PER_BATCH * CHARS_PER_TOKEN;

type ExcerptBatch = {
    excerpts: Entry[];
    ids: string[];
};

/**
 * Groups excerpts into batches based on token limits
 */
const createBatches = (excerpts: Entry[]): ExcerptBatch[] => {
    const batches: ExcerptBatch[] = [];
    let currentBatch: Entry[] = [];
    let currentChars = 0;

    for (const excerpt of excerpts) {
        const excerptChars = (excerpt.arabic?.length || 0) + excerpt.id.length + 5; // 5 for " - " and newlines

        if (currentChars + excerptChars > MAX_CHARS_PER_BATCH && currentBatch.length > 0) {
            batches.push({
                excerpts: currentBatch,
                ids: currentBatch.map((e) => e.id),
            });
            currentBatch = [];
            currentChars = 0;
        }

        currentBatch.push(excerpt);
        currentChars += excerptChars;
    }

    if (currentBatch.length > 0) {
        batches.push({
            excerpts: currentBatch,
            ids: currentBatch.map((e) => e.id),
        });
    }

    return batches;
};

/**
 * Formats a batch of excerpts into a prompt string
 */
const formatBatchPrompt = (bookTitle: string, excerpts: Entry[]): string => {
    const prompt = TRANSLATE_PROMPT.replace('{{book}}', bookTitle);
    const content = excerpts.map((e) => `${e.id} - ${e.arabic}`).join('\n\n');

    return `${prompt}\n\n${content}`;
};

/**
 * Parses the LLM response to extract translations
 */
const parseTranslations = (response: string): Map<string, string> => {
    const translations = new Map<string, string>();
    // Match ID followed by dash and translation text
    const pattern = /^([BCFTP]\d+[a-j]?)\s*[-–—]\s*(.+?)(?=\n[BCFTP]\d+[a-j]?\s*[-–—]|$)/gms;

    let match: RegExpExecArray | null;

    while ((match = pattern.exec(response)) !== null) {
        const [, id, translation] = match;
        translations.set(id.trim(), translation.trim());
    }

    return translations;
};

/**
 * Creates a validator function for a specific batch
 */
const createValidator = (expectedIds: string[]) => {
    return (responseText: string): boolean => {
        const translations = parseTranslations(responseText);

        // Check all expected IDs are present
        for (const id of expectedIds) {
            if (!translations.has(id)) {
                logger.warn(`Missing translation for ID: ${id}`);
                return false;
            }
        }

        // Check IDs are in correct order
        const responseIds = Array.from(translations.keys());

        for (let i = 0; i < expectedIds.length; i++) {
            if (responseIds[i] !== expectedIds[i]) {
                logger.warn(`ID order mismatch: expected ${expectedIds[i]}, got ${responseIds[i]}`);
                return false;
            }
        }

        return true;
    };
};

/**
 * Initializes the kukamba LLM client
 */
const initLlmClient = (apiKeys: string[]) => {
    const keyManager = new ApiKeyManager(apiKeys, LoadBalancingStrategy.WeightedHealth, {
        circuitBreakerResetTime: 60000,
        maxConsecutiveFailures: 3,
        maxParallelRequestsPerKey: 5,
    });

    const geminiAdapter = async (prompt: string, apiKey: string, config?: any) => {
        const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: config?.timeout || 600000 } });

        return await ai.models.generateContent({
            config: { temperature: 0.1 },
            contents: prompt,
            model: config?.model || MODEL,
        });
    };

    const textExtractor = (response: any): string | null => {
        return response.text || null;
    };

    return new LlmClient(geminiAdapter, textExtractor, keyManager, {
        backoffMultiplier: 2,
        initialDelay: 1000,
        maxDelay: 30000,
        maxRetries: 3,
        timeout: 600000,
    });
};

/**
 * Translates excerpts for a collection using AI
 */
export const translateExcerpts = async (collectionId: string) => {
    const config = new Conf<Config>({ projectName: 'ilmtest-cli' });
    const apiKeys = config.get('geminiApiKeys');

    if (!apiKeys || apiKeys.length === 0) {
        logger.error('No Gemini API keys configured. Please set geminiApiKeys in config.');
        process.exit(1);
    }

    const dir = path.join(OUTPUT_DIR, collectionId);
    const excerptFile = Bun.file(path.join(dir, 'excerpts.json'));

    if (!(await excerptFile.exists())) {
        logger.error(`Excerpts file not found: ${excerptFile.name}`);
        process.exit(1);
    }

    const data = (await excerptFile.json()) as Excerpts;
    const bookTitle = data.collection?.title || `Collection ${collectionId}`;

    // Filter excerpts without translations
    const untranslated = data.excerpts.filter((e) => !e.translation && e.arabic);

    if (untranslated.length === 0) {
        logger.info('All excerpts are already translated!');
        return;
    }

    logger.info(`Found ${untranslated.length} untranslated excerpts out of ${data.excerpts.length} total`);
    logger.info(`Book: ${bookTitle}`);
    logger.info(`Using ${apiKeys.length} API key(s)`);

    // Create batches
    const batches = createBatches(untranslated);
    logger.info(`Created ${batches.length} batches for processing`);

    // Initialize LLM client
    const llmClient = initLlmClient(apiKeys);

    // Process batches using kukamba's generateBatch with concurrency of 5
    const prompts = batches.map((batch) => formatBatchPrompt(bookTitle, batch.excerpts));
    const validators = batches.map((batch) => createValidator(batch.ids));

    logger.info('Starting translation...');

    const results = await llmClient.generateBatch(prompts, validators, { model: MODEL, timeout: 600000 }, 5);

    // Process results
    let successCount = 0;
    let failureCount = 0;
    const idToEntry = new Map(data.excerpts.map((e) => [e.id, e]));

    for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const batch = batches[i];

        if (result.isValid && result.content) {
            const translations = parseTranslations(result.content);

            for (const [id, translation] of translations) {
                const entry = idToEntry.get(id);
                if (entry) {
                    entry.translation = translation;
                    entry.translator = TRANSLATOR_ID;
                    entry.lastUpdatedAt = Date.now();
                    successCount++;
                }
            }

            logger.info(
                `Batch ${i + 1}/${batches.length}: ${batch.ids.length} translations (${result.attempts} attempts)`,
            );
        } else {
            failureCount += batch.ids.length;
            logger.error(`Batch ${i + 1}/${batches.length} failed after ${result.attempts} attempts`);

            if (result.content) {
                logger.error(`Response validation failed for IDs: ${batch.ids.join(', ')}`);
            }
        }
    }

    // Save results
    if (successCount > 0) {
        data.lastUpdatedAt = Date.now();

        await Bun.write(excerptFile.name!, JSON.stringify(data, null, 2));

        logger.info(`Saved ${successCount} translations to ${excerptFile.name}`);
    }

    logger.info(`Translation complete: ${successCount} successful, ${failureCount} failed`);

    const remaining = data.excerpts.filter((e) => !e.translation).length;
    if (remaining > 0) {
        logger.info(`${remaining} excerpts still need translation`);
    }
};
