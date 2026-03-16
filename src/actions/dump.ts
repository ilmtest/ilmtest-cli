import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { GoogleGenAI } from '@google/genai';
import { confirm } from '@inquirer/prompts';
import Conf from 'conf';
import type { Config, Excerpts } from '@/types.js';
import { ApiKeyManager } from '@/utils/apiKeyManager.js';
import { OUTPUT_DIR } from '@/utils/constants.js';
import { zipFile } from '@/utils/io.js';
import logger from '@/utils/logger.js';
import { getHuggingFaceToken, HF_ENV, uploadToHuggingFace } from '@/utils/network.js';

/**
 * Represents a text chunk with its embedding vector
 */
type Chunk = {
    id: string;
    content: string;
    embedding?: number[];
};

/**
 * Stored embeddings data including metadata
 */
type EmbeddingsData = {
    chunks: Chunk[];
    contractVersion: string;
    model: string;
    dimensions: number;
    taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY' | 'SEMANTIC_SIMILARITY' | 'CLASSIFICATION' | 'CLUSTERING';
    createdAt: string;
};

/**
 * Chunk with similarity score for ranking search results
 */
type RankedChunk = Chunk & { similarity: number };

/**
 * Parsed command-line arguments
 */
type CommandArgs = {
    command: string;
    inputFile?: string;
    outputFile?: string;
    embeddingsFile?: string;
    query?: string;
    dimensions?: number;
    topK?: number;
};

/**
 * Shared context passed to command handlers
 */
type Context = {
    config: Conf<Config>;
    keyManager: ApiKeyManager;
};

const EMBEDDING_MODEL = 'gemini-embedding-001';
const ANALYSIS_MODEL = 'gemini-2.5-pro';

const DIMENSIONS = {
    DEFAULT: 3072,
    HIGH: 3072,
    LOW: 768,
    MEDIUM: 1536,
} as const;

const CHUNKING = {
    MAX_CHARS: 2043 * 3.5,
    SEPARATOR: '\n\n',
    TARGET_CHARS: 5000,
} as const;

const BATCH = {
    DELAY_MS: 500,
    MAX_RETRIES: 3,
    RETRY_DELAY_MS: 2000,
    SIZE: 10,
} as const;

const QUERY = {
    DEFAULT_TOP_K: 15,
    DISPLAY_TOP_K: 10,
} as const;

const VALID_DIMENSIONS = [DIMENSIONS.LOW, DIMENSIONS.MEDIUM, DIMENSIONS.HIGH] as const;

/**
 * Calculates cosine similarity between two embedding vectors
 */
const cosineSimilarity = (a: number[], b: number[]): number => {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
};

/**
 * Ensures directory exists for a given file path
 */
const ensureDir = async (filePath: string): Promise<void> => {
    const dir = filePath.split('/').slice(0, -1).join('/');
    if (dir) {
        await mkdir(dir, { recursive: true });
    }
};

/**
 * Generates default output path based on input path and suffix
 */
const getDefaultOutputPath = (inputPath: string, suffix: string): string => {
    const dir = inputPath.split('/').slice(0, -1).join('/');
    return dir ? `${dir}/${suffix}` : suffix;
};

/**
 * Generates timestamped output path for query results
 */
const generateQueryOutputPath = (embeddingsPath: string, query: string): string => {
    const dir = embeddingsPath.split('/').slice(0, -1).join('/');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const querySlug = query
        .slice(0, 30)
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .toLowerCase();
    const filename = `query_${querySlug}_${timestamp}.txt`;
    return dir ? `${dir}/${filename}` : filename;
};

/**
 * Parses command-line arguments into structured format
 */
const parseArgs = (): CommandArgs => {
    const [command, ...rest] = process.argv.slice(2);

    if (command === 'create-embeddings') {
        const [inputFile, outputFile, dimensionsStr] = rest;
        const dimensions = parseInt(dimensionsStr || String(DIMENSIONS.DEFAULT), 10);
        return { command, dimensions, inputFile, outputFile };
    }

    if (command === 'query') {
        const [embeddingsFile, query, outputFile, topKStr] = rest;
        const topK = parseInt(topKStr || String(QUERY.DEFAULT_TOP_K), 10);
        return { command, embeddingsFile, outputFile, query, topK };
    }

    if (command === 'stats') {
        const [embeddingsFile] = rest;
        return { command, embeddingsFile };
    }

    return { command };
};

/**
 * Splits excerpts into optimally-sized chunks for embedding generation
 */
const createChunks = (excerpts: Excerpts['excerpts']): Chunk[] => {
    const chunks: Chunk[] = [];
    let currentChunk: string[] = [];
    let currentChunkIds: string[] = [];
    let currentLength = 0;

    const saveCurrentChunk = () => {
        if (currentChunk.length > 0) {
            chunks.push({
                content: currentChunk.join(CHUNKING.SEPARATOR),
                id: currentChunkIds.join(','),
            });
            currentChunk = [];
            currentChunkIds = [];
            currentLength = 0;
        }
    };

    for (const excerpt of excerpts) {
        const content = `${excerpt.id} - ${excerpt.translation}`;
        const contentLength = content.length;

        if (contentLength > CHUNKING.MAX_CHARS) {
            saveCurrentChunk();
            logger.warn(`Translation ${excerpt.id} is very large (${contentLength} chars), creating separate chunk`);
            chunks.push({
                content: content.substring(0, CHUNKING.MAX_CHARS),
                id: excerpt.id,
            });
            continue;
        }

        if (currentLength + contentLength > CHUNKING.TARGET_CHARS && currentChunk.length > 0) {
            saveCurrentChunk();
        }

        currentChunk.push(content);
        currentChunkIds.push(excerpt.id);
        currentLength += contentLength + CHUNKING.SEPARATOR.length;
    }

    saveCurrentChunk();
    return chunks;
};

/**
 * Generates embedding vector for text content using a fresh API client
 */
const generateEmbedding = async (
    keyManager: ApiKeyManager,
    content: string,
    dimensions: number,
    taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY',
): Promise<number[]> => {
    const ai = new GoogleGenAI({ apiKey: keyManager.getNext() });
    const result = await ai.models.embedContent({
        config: {
            outputDimensionality: dimensions,
            taskType,
        },
        contents: content,
        model: EMBEDDING_MODEL,
    });
    return result.embeddings[0].values;
};

/**
 * Processes a single chunk with retry logic for rate limits (up to 3 attempts)
 */
const processChunkWithRetry = async (chunk: Chunk, keyManager: ApiKeyManager, dimensions: number): Promise<void> => {
    let lastError: any;

    for (let attempt = 1; attempt <= BATCH.MAX_RETRIES; attempt++) {
        try {
            chunk.embedding = await generateEmbedding(keyManager, chunk.content, dimensions, 'RETRIEVAL_DOCUMENT');
            if (attempt > 1) {
                logger.info(`Retry ${attempt - 1} successful for chunk ${chunk.id}`);
            }
            return;
        } catch (error: any) {
            lastError = error;
            const isRateLimit = error.message?.includes('429') || error.message?.includes('rate limit');

            if (attempt < BATCH.MAX_RETRIES) {
                if (isRateLimit) {
                    logger.info(
                        `Rate limit hit for chunk ${chunk.id}, attempt ${attempt}/${BATCH.MAX_RETRIES}. Retrying with new key...`,
                    );
                } else {
                    logger.warn(
                        `Error for chunk ${chunk.id}, attempt ${attempt}/${BATCH.MAX_RETRIES}: ${error.message || error}`,
                    );
                }
                await new Promise((resolve) => setTimeout(resolve, BATCH.RETRY_DELAY_MS));
            }
        }
    }

    logger.error(
        `All ${BATCH.MAX_RETRIES} retry attempts failed for chunk ${chunk.id}: ${lastError.message || lastError}`,
    );
    chunk.embedding = [];
    throw lastError;
};

/**
 * Processes a batch of chunks in parallel
 */
const processBatch = async (
    batch: Chunk[],
    keyManager: ApiKeyManager,
    dimensions: number,
    batchNum: number,
    totalBatches: number,
    startIdx: number,
): Promise<{ success: number; errors: number }> => {
    logger.info(`Processing batch ${batchNum}/${totalBatches} (chunks ${startIdx + 1}-${startIdx + batch.length})`);

    let success = 0;
    let errors = 0;

    await Promise.all(
        batch.map(async (chunk) => {
            try {
                await processChunkWithRetry(chunk, keyManager, dimensions);
                success++;
            } catch {
                errors++;
            }
        }),
    );

    logger.info(`Batch complete: ${success} successful, ${errors} errors`);
    return { errors, success };
};

/**
 * Generates prompt for theological analysis
 */
const generateAnalysisPrompt = (query: string, rankedChunks: RankedChunk[]): string => {
    const relevantContent = rankedChunks
        .map(
            (chunk, i) =>
                `[Chunk ${i + 1}] Translation IDs: ${chunk.id} (Similarity: ${chunk.similarity.toFixed(4)})\n${chunk.content}`,
        )
        .join('\n\n---\n\n');

    return `You are a knowledgeable Islamic scholar analyzing theological content. Your task is to provide a thorough, nuanced analysis based on the excerpts provided.

Query: ${query}

Instructions:
1. Analyze the excerpts carefully for theological positions, statements, and arguments
2. When referencing the text, ALWAYS cite the specific Translation IDs (e.g., P36661, C1583)
3. For theological evaluation queries (like identifying aqeedah violations), provide:
   - Direct quotes from the text (with Translation IDs)
   - Specific theological analysis
   - Clear reasoning for your assessment
4. If the query asks about violations or contradictions, be precise about what you find
5. If no clear evidence exists in the excerpts, state this explicitly
6. Present your findings in a structured, scholarly manner

Relevant excerpts (ranked by relevance):
${relevantContent}

Please provide your detailed analysis:`.trim();
};

/**
 * Formats complete output for query results
 */
const formatFullOutput = (
    query: string,
    embeddingsData: EmbeddingsData,
    rankedChunks: RankedChunk[],
    answer: string,
    topK: number,
): string => {
    const relevantContent = rankedChunks
        .map(
            (chunk, i) =>
                `[Chunk ${i + 1}] Translation IDs: ${chunk.id} (Similarity: ${chunk.similarity.toFixed(4)})\n${chunk.content}`,
        )
        .join('\n\n---\n\n');

    const topChunks = rankedChunks
        .map((c, i) => `${i + 1}. ${c.id} (similarity: ${c.similarity.toFixed(4)})`)
        .join('\n');

    return `Query: ${query}
Model: ${embeddingsData.model} (${embeddingsData.dimensions} dimensions)
Task Types: RETRIEVAL_DOCUMENT (corpus) + RETRIEVAL_QUERY (query)

Top ${topK} relevant chunks:
${topChunks}

Analysis:
${answer}

Relevant excerpts:
${relevantContent}`;
};

/**
 * Creates embeddings for all translations in input file
 */
const createEmbeddings = async (args: CommandArgs, ctx: Context): Promise<void> => {
    const { inputFile, dimensions = DIMENSIONS.DEFAULT } = args;

    if (!inputFile) {
        logger.error('Usage: bun src/actions/dump.ts create-embeddings <input_file> [output_file] [dimensions]');
        logger.error(
            'Example: bun src/actions/dump.ts create-embeddings tmp/525/excerpts.json tmp/525/embeddings.json 1536',
        );
        logger.error(
            '         bun src/actions/dump.ts create-embeddings tmp/525/excerpts.json (uses default output path)',
        );
        logger.error('Recommended dimensions for theological analysis:');
        logger.error(`  ${DIMENSIONS.MEDIUM} - Balanced (recommended for most cases) [DEFAULT]`);
        logger.error(`  ${DIMENSIONS.HIGH} - Highest quality (for nuanced theological distinctions)`);
        logger.error(`  ${DIMENSIONS.LOW}  - Faster/cheaper (may miss subtle differences)`);
        process.exit(1);
    }

    if (!VALID_DIMENSIONS.includes(dimensions as (typeof VALID_DIMENSIONS)[number])) {
        logger.error(`Dimensions must be ${VALID_DIMENSIONS.join(', ')}`);
        process.exit(1);
    }

    if (!existsSync(inputFile)) {
        logger.error(`Input file not found: ${inputFile}`);
        process.exit(1);
    }

    const outputFile = args.outputFile || getDefaultOutputPath(inputFile, `embeddings-${dimensions}.json`);

    logger.info('Loading translations');
    const data: Excerpts = await Bun.file(inputFile).json();

    logger.info(`Using ${ctx.keyManager.getCount()} API key(s) for rate limit management`);

    const chunks = createChunks(data.excerpts);
    const avgChunkSize = Math.round(chunks.reduce((sum, c) => sum + c.content.length, 0) / chunks.length);

    logger.info(`Created ${chunks.length} optimized chunks from ${data.excerpts.length} translations`);
    logger.info(`Average chunk size: ${avgChunkSize} characters`);
    logger.info(`Processing ${chunks.length} chunks with task_type=RETRIEVAL_DOCUMENT`);
    logger.info(`Max retries per chunk: ${BATCH.MAX_RETRIES}`);

    let totalSuccess = 0;
    let totalErrors = 0;
    const totalBatches = Math.ceil(chunks.length / BATCH.SIZE);

    for (let i = 0; i < chunks.length; i += BATCH.SIZE) {
        const batch = chunks.slice(i, i + BATCH.SIZE);
        const batchNum = Math.floor(i / BATCH.SIZE) + 1;

        const { success, errors } = await processBatch(batch, ctx.keyManager, dimensions, batchNum, totalBatches, i);
        totalSuccess += success;
        totalErrors += errors;

        if (i + BATCH.SIZE < chunks.length) {
            await new Promise((resolve) => setTimeout(resolve, BATCH.DELAY_MS));
        }
    }

    const embeddingsData: EmbeddingsData = {
        chunks,
        contractVersion: 'v1.0',
        createdAt: new Date().toISOString(),
        dimensions,
        model: EMBEDDING_MODEL,
        taskType: 'RETRIEVAL_DOCUMENT',
    };

    await ensureDir(outputFile);
    await Bun.write(outputFile, JSON.stringify(embeddingsData, null, 2));

    const zipPath = await zipFile(outputFile);
    logger.info(`Embeddings generated and saved to: ${outputFile}`);
    logger.info(`Compressed to: ${zipPath}`);
    logger.info(`Total chunks: ${chunks.length}`);
    logger.info(`Successful embeddings: ${totalSuccess}`);
    logger.info(`Failed embeddings: ${totalErrors}`);
    logger.info(`Model: ${EMBEDDING_MODEL} with task_type=RETRIEVAL_DOCUMENT`);
    logger.info(`Dimensions: ${dimensions}`);

    const shouldUpload = await confirm({
        message: 'Do you want to upload the embeddings zip to HuggingFace?',
    });

    if (shouldUpload) {
        try {
            const token = getHuggingFaceToken();
            const repoId = process.env[HF_ENV.EMBEDDINGS_REPO]!;
            const hfFileName = basename(zipPath);

            await uploadToHuggingFace({
                filePath: zipPath,
                pathInRepo: hfFileName,
                repoId,
                token,
            });
        } catch (error: any) {
            logger.error(`Failed to upload to HuggingFace: ${error.message}`);
        }
    }
};

/**
 * Queries embeddings using semantic search and generates analysis
 */
const queryEmbeddings = async (args: CommandArgs, ctx: Context): Promise<void> => {
    const { embeddingsFile, query, topK = QUERY.DEFAULT_TOP_K } = args;

    if (!query || !embeddingsFile) {
        logger.error('Usage: bun src/actions/dump.ts query <embeddings_file> "<query>" [output_file] [top_k]');
        logger.error(
            'Example: bun src/actions/dump.ts query tmp/525/embeddings.json "Find aqeedah violations from Salaf"',
        );
        logger.error(
            '         bun src/actions/dump.ts query tmp/525/embeddings.json "Find violations" results/custom.txt 20',
        );
        process.exit(1);
    }

    if (!existsSync(embeddingsFile)) {
        logger.error(`Embeddings file not found: ${embeddingsFile}`);
        logger.error('Run "create-embeddings" command first');
        process.exit(1);
    }

    const outputFile = args.outputFile || generateQueryOutputPath(embeddingsFile, query);

    logger.info('Loading embeddings');
    const embeddingsData: EmbeddingsData = await Bun.file(embeddingsFile).json();

    logger.info(`Using ${ctx.keyManager.getCount()} API key(s) for rate limit management`);
    logger.info(`Loaded ${embeddingsData.chunks.length} chunks`);
    logger.info(`Dimensions: ${embeddingsData.dimensions}`);
    logger.info('Generating query embedding with task_type=RETRIEVAL_QUERY');

    const queryVector = await generateEmbedding(ctx.keyManager, query, embeddingsData.dimensions, 'RETRIEVAL_QUERY');

    logger.info('Finding most relevant chunks');

    const rankedChunks = embeddingsData.chunks
        .filter((chunk) => chunk.embedding?.length)
        .map((chunk) => ({
            ...chunk,
            similarity: cosineSimilarity(queryVector, chunk.embedding!),
        }))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK);

    logger.info(`Found ${rankedChunks.length} relevant chunks`);
    logger.info('Top matches:');
    rankedChunks.slice(0, QUERY.DISPLAY_TOP_K).forEach((chunk, i) => {
        logger.info(`  ${i + 1}. ${chunk.id} (similarity: ${chunk.similarity.toFixed(4)})`);
    });

    logger.info(`Analyzing with ${ANALYSIS_MODEL}`);

    // Create fresh AI instance for analysis
    const ai = new GoogleGenAI({ apiKey: ctx.keyManager.getNext() });
    const response = await ai.models.generateContent({
        contents: generateAnalysisPrompt(query, rankedChunks),
        model: ANALYSIS_MODEL,
    });

    const answer = response.text;

    logger.info('\nAnalysis:');
    logger.info(answer);

    await ensureDir(outputFile);
    await Bun.write(outputFile, formatFullOutput(query, embeddingsData, rankedChunks, answer, topK));
    logger.info(`\nAnalysis saved to: ${outputFile}`);
};

/**
 * Displays statistics about embeddings file
 */
const showStats = async (args: CommandArgs): Promise<void> => {
    const { embeddingsFile } = args;

    if (!embeddingsFile) {
        logger.error('Usage: bun src/actions/dump.ts stats <embeddings_file>');
        logger.error('Example: bun src/actions/dump.ts stats tmp/525/embeddings.json');
        process.exit(1);
    }

    if (!existsSync(embeddingsFile)) {
        logger.error(`Embeddings file not found: ${embeddingsFile}`);
        process.exit(1);
    }

    const embeddingsData: EmbeddingsData = await Bun.file(embeddingsFile).json();
    const validEmbeddings = embeddingsData.chunks.filter((c) => c.embedding?.length);
    const avgLength =
        embeddingsData.chunks.reduce((sum, c) => sum + c.content.length, 0) / embeddingsData.chunks.length;

    logger.info('Embeddings statistics:');
    logger.info(`Contract version: ${embeddingsData.contractVersion || 'unknown'}`);
    logger.info(`Total chunks: ${embeddingsData.chunks.length}`);
    logger.info(`Valid embeddings: ${validEmbeddings.length}`);
    logger.info(`Model: ${embeddingsData.model}`);
    logger.info(`Dimensions: ${embeddingsData.dimensions}`);
    logger.info(`Task type: ${embeddingsData.taskType || 'RETRIEVAL_DOCUMENT'}`);
    logger.info(`Created: ${embeddingsData.createdAt}`);
    logger.info(`Average chunk length: ${Math.round(avgLength)} characters`);
};

/**
 * Displays help information for all commands
 */
const showHelp = (): void => {
    logger.info('Islamic Text Embeddings Manager with Semantic Search');
    logger.info('\nCommands:');
    logger.info('  create-embeddings <input_file> [output_file] [dimensions]');
    logger.info('    Generate embeddings for all translations (one-time setup)');
    logger.info('    Uses task_type=RETRIEVAL_DOCUMENT for optimal retrieval performance');
    logger.info(
        `    Dimensions: ${DIMENSIONS.MEDIUM} (default), ${DIMENSIONS.HIGH} (highest quality), ${DIMENSIONS.LOW} (faster)`,
    );
    logger.info(`    Retries: Up to ${BATCH.MAX_RETRIES} attempts per chunk with different API keys`);
    logger.info('    Output defaults to same folder as input file');
    logger.info('    Example: bun src/actions/dump.ts create-embeddings tmp/525/excerpts.json');
    logger.info(
        `    Custom:  bun src/actions/dump.ts create-embeddings tmp/525/excerpts.json custom/path.json ${DIMENSIONS.HIGH}`,
    );
    logger.info('\n  query <embeddings_file> "<query>" [output_file] [top_k]');
    logger.info('    Query translations using semantic search');
    logger.info('    Uses task_type=RETRIEVAL_QUERY for optimal query matching');
    logger.info('    Output defaults to same folder as embeddings file with auto-generated name');
    logger.info('    Example: bun src/actions/dump.ts query tmp/525/embeddings.json "Find aqeedah violations"');
    logger.info(
        '    Custom:  bun src/actions/dump.ts query tmp/525/embeddings.json "Find violations" results/custom.txt 20',
    );
    logger.info('\n  stats <embeddings_file>');
    logger.info('    Show statistics about embeddings file');
    logger.info('    Example: bun src/actions/dump.ts stats tmp/525/embeddings.json');
};

/**
 * Initializes application context with config and API clients
 */
const initContext = (): Context => {
    const config = new Conf<Config>({ projectName: 'ilmtest-cli' });
    const apiKeys = config.get('geminiApiKeys');

    if (!apiKeys) {
        logger.error('API keys not configured. Please set geminiApiKeys in config.');
        process.exit(1);
    }

    const keyManager = new ApiKeyManager(apiKeys);

    return { config, keyManager };
};

/**
 * Creates embeddings for a collection using its ID
 * This is the main entry point when called from the CLI via --embed flag
 *
 * @param collectionId - The collection ID (e.g., "525")
 * @param dimensions - Optional embedding dimensions (defaults to 3072)
 *
 * @example
 * ```bash
 * bun start --embed=525
 * ```
 */
export const createEmbeddingsForCollection = async (
    collectionId: string,
    dimensions: number = DIMENSIONS.DEFAULT,
): Promise<void> => {
    const dir = join(OUTPUT_DIR, collectionId);
    const inputFile = join(dir, 'excerpts.json');
    const outputFile = join(dir, `embeddings-${dimensions}.json`);
    const hfZipFileName = `${collectionId}.json.zip`;

    if (!existsSync(inputFile)) {
        logger.error(`Input file not found: ${inputFile}`);
        logger.error(`Make sure tmp/${collectionId}/excerpts.json exists`);
        process.exit(1);
    }

    if (!VALID_DIMENSIONS.includes(dimensions as (typeof VALID_DIMENSIONS)[number])) {
        logger.error(`Dimensions must be ${VALID_DIMENSIONS.join(', ')}`);
        process.exit(1);
    }

    const ctx = initContext();

    logger.info(`Creating embeddings for collection ${collectionId}`);
    logger.info(`Input: ${inputFile}`);
    logger.info(`Output: ${outputFile}`);
    logger.info(`Dimensions: ${dimensions}`);

    logger.info('Loading translations');
    const data: Excerpts = await Bun.file(inputFile).json();

    logger.info(`Using ${ctx.keyManager.getCount()} API key(s) for rate limit management`);

    const chunks = createChunks(data.excerpts);
    const avgChunkSize = Math.round(chunks.reduce((sum, c) => sum + c.content.length, 0) / chunks.length);

    logger.info(`Created ${chunks.length} optimized chunks from ${data.excerpts.length} translations`);
    logger.info(`Average chunk size: ${avgChunkSize} characters`);
    logger.info(`Processing ${chunks.length} chunks with task_type=RETRIEVAL_DOCUMENT`);
    logger.info(`Max retries per chunk: ${BATCH.MAX_RETRIES}`);

    let totalSuccess = 0;
    let totalErrors = 0;
    const totalBatches = Math.ceil(chunks.length / BATCH.SIZE);

    for (let i = 0; i < chunks.length; i += BATCH.SIZE) {
        const batch = chunks.slice(i, i + BATCH.SIZE);
        const batchNum = Math.floor(i / BATCH.SIZE) + 1;

        const { success, errors } = await processBatch(batch, ctx.keyManager, dimensions, batchNum, totalBatches, i);
        totalSuccess += success;
        totalErrors += errors;

        if (i + BATCH.SIZE < chunks.length) {
            await new Promise((resolve) => setTimeout(resolve, BATCH.DELAY_MS));
        }
    }

    const embeddingsData: EmbeddingsData = {
        chunks,
        contractVersion: 'v1.0',
        createdAt: new Date().toISOString(),
        dimensions,
        model: EMBEDDING_MODEL,
        taskType: 'RETRIEVAL_DOCUMENT',
    };

    await ensureDir(outputFile);
    await Bun.write(outputFile, JSON.stringify(embeddingsData, null, 2));

    // Zip with collection-specific filename for HuggingFace
    const zipPath = await zipFile(outputFile, join(dir, hfZipFileName));
    logger.info(`Embeddings generated and saved to: ${outputFile}`);
    logger.info(`Compressed to: ${zipPath}`);
    logger.info(`Total chunks: ${chunks.length}`);
    logger.info(`Successful embeddings: ${totalSuccess}`);
    logger.info(`Failed embeddings: ${totalErrors}`);
    logger.info(`Model: ${EMBEDDING_MODEL} with task_type=RETRIEVAL_DOCUMENT`);
    logger.info(`Dimensions: ${dimensions}`);

    const shouldUpload = await confirm({
        message: 'Do you want to upload the embeddings zip to HuggingFace?',
    });

    if (shouldUpload) {
        try {
            const token = getHuggingFaceToken();
            const repoId = process.env[HF_ENV.EMBEDDINGS_REPO]!;

            await uploadToHuggingFace({
                filePath: zipPath,
                pathInRepo: hfZipFileName,
                repoId,
                token,
            });
        } catch (error: any) {
            logger.error(`Failed to upload to HuggingFace: ${error.message}`);
        }
    }
};

/**
 * Main entry point
 */
const main = async (): Promise<void> => {
    const args = parseArgs();

    try {
        if (args.command === 'stats') {
            await showStats(args);
        } else if (args.command === 'create-embeddings' || args.command === 'query') {
            const ctx = initContext();

            if (args.command === 'create-embeddings') {
                await createEmbeddings(args, ctx);
            } else {
                await queryEmbeddings(args, ctx);
            }
        } else {
            showHelp();
            process.exit(args.command ? 1 : 0);
        }
    } catch (error: any) {
        logger.error(error, 'Error:');
        process.exit(1);
    }
};

// Only run main() when executed directly as a script, not when imported
if (import.meta.main) {
    main();
}
