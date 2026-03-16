import { promises as fs } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { confirm, select } from '@inquirer/prompts';
import { getBookContents } from 'ketab-online-sdk';
import { type BookData, configure, getBook, getBookMetadata, mapPageCharacterContent } from 'shamela';
import { getCollection } from '@/api/collections.js';
import type { Collection, MatnParseOptions, ShamelaBook } from '@/types.js';
import { CAPTURE_CONTINUOUS_PAGES, OUTPUT_DIR } from '@/utils/constants.js';
import logger from '@/utils/logger.js';
import { loadOrDownload } from '@/utils/network.js';
import { getPageBodyAndFootnotes } from '@/utils/textUtils.js';

/**
 * Parses command line arguments for Shamela operations
 * @returns Parsed configuration object with collection ID, page range, and options
 * @throws Error if no collection is specified
 */
const parseInputArgs = () => {
    const { values } = parseArgs({
        options: {
            entries: {
                type: 'string',
            },
            migrate: {
                type: 'string',
            },
            pages: {
                type: 'string',
            },
            shamela: {
                type: 'string',
            },
            unused: {
                type: 'string',
            },
        },
        strict: true,
    });

    const [from = 1, to = Number.MAX_SAFE_INTEGER] = (values.pages?.split('-') || []).map(Number);

    return {
        collectionId: String(values.shamela || values.migrate),
        entriesToFilter: values.entries?.split(','),
        from,
        to,
        unused: values.unused,
    };
};

function parseHTMLContent(html: string) {
    const paragraphs: { text: string; id: string }[] = [];

    // Match all paragraph tags with id attributes
    const paragraphRegex = /<p[^>]+id="(p-\d+)"[^>]*>(.*?)<\/p>/gs;

    let match: RegExpExecArray | null;
    while ((match = paragraphRegex.exec(html)) !== null) {
        const id = match[1]; // e.g., "p-1"
        const content = match[2]; // HTML content inside the paragraph

        // Convert id from "p-1" to "P1"
        const formattedId = id.replace('p-', 'P');

        // Remove all HTML tags from content
        const text = content.replace(/<[^>]+>/g, '');

        paragraphs.push({
            id: formattedId,
            text: text.trim(),
        });
    }

    return paragraphs.map((p) => p.text).join('\n');
}

/**
 * Loads a Shamela book with specified page range and processes content
 * @param bookId - The Shamela book identifier
 * @param param1 - Tuple containing from and to page numbers
 * @param dir - Directory to cache the book data
 * @returns Promise resolving to processed ShamelaBook object
 */
const loadBook = async (collection: Collection, [from, to]: number[], dir: string) => {
    const [bookId] = collection.fid!.map((fid) => fid.id).map(Number);

    const book = await loadOrDownload<BookData>(
        'book',
        async () => {
            if (collection.library === 71) {
                // ketabonline
                const json = await getBookContents(bookId);

                const result = {
                    pages: json.pages
                        .filter((p) => p.part)
                        .map(({ content, id, page, part }) => {
                            return {
                                content: parseHTMLContent(content),
                                id,
                                pp: page,
                                volume: parseInt((part as any).name, 10),
                            };
                        }),
                    titles: json.index.map(({ title, parent, page_id: page }) => ({
                        content: title,
                        page,
                        parent,
                    })),
                };

                return json as any;
            }

            const [metadata, shamelaBook] = await Promise.all([getBookMetadata(bookId), getBook(bookId)]);

            return {
                majorRelease: metadata.majorRelease,
                minorRelease: metadata.minorRelease,
                shamelaId: bookId,
                ...shamelaBook,
            };
        },
        dir,
    );

    if ((book as any).contractVersion) {
        const { pages } = book as any;
        return {
            pages: pages.map((p: any) => ({
                content: p.text.replace(/\n/g, '\r').replace(/\([\u0660-\u0669]+\)/g, ''),
                footer: p.footnotes,
                id: p.page,
                pp: p.volumePage,
                volume: p.volume,
            })),
        } as ShamelaBook;
    }

    if ((book as any).ocrEngine) {
        const { pages } = book as any;
        return {
            pages: pages.map((p: any) => ({
                content: p.body.replace(/\n/g, '\r').replace(/\([\u0660-\u0669]+\)/g, ''),
                id: p.page,
                pp: p.pp,
                volume: p.part,
            })),
        } as ShamelaBook;
    }

    book.pages = book.pages.filter((p) => p.id >= from && p.id <= to);
    book.pages = book.pages.map(({ part, page, ...p }) => {
        const [content, footer] = getPageBodyAndFootnotes(p.content);
        return { ...p, content, ...(footer && { footer }), pp: page || 0, volume: Number(part) || 1 };
    });
    book.titles = book.titles.map(({ content, ...t }) => ({ ...t, content: mapPageCharacterContent(content) }));

    return book as ShamelaBook;
};

const loadOptions = async (dir: string) => {
    const optionsFile = Bun.file(path.join(dir, 'options.json'));
    const hasOptions = await optionsFile.exists();
    const options: MatnParseOptions = hasOptions ? await optionsFile.json() : {};

    if (!hasOptions) {
        options.numeralStrategy = (await select({
            choices: [
                { name: '8 - Dashed', value: 'dashed' },
                { name: '[8] Square', value: 'square' },
                { name: 'None', value: '' },
            ],
            default: 'dashed',
            message: 'What kinds of numeral index markers does your book use?',
        })) as any;

        const spanning = await confirm({
            message: `Does each entry span more than one page?`,
        });

        if (spanning) {
            const trailing = await confirm({
                message: `Do you want to cut each entry based on the last punctuation mark?`,
            });

            options.pageSpanning = trailing ? CAPTURE_CONTINUOUS_PAGES : 'true';

            if (trailing) {
                options.patternToType = {
                    '^((word1|word2|word3|word4).*)': 0,
                };

                options.prevEntryMarkerPattern = '(التَّوْفِيقُ|وَلِلَّهِ الْحَمْدُ|التَّوْفِيقُ|كُلِّ حَالٍ)\\.$';
            }
        }

        if (options.numeralStrategy) {
            const autoFix = await confirm({
                message: `Should we automatically fix indexes`,
            });

            if (autoFix) {
                options.fix = 'indexes';
            }
        }

        await optionsFile.write(JSON.stringify(options));
    }

    // \n.",
    // ^\s?.\s?$

    return options;
};

/**
 * Loads and prepares all necessary data for Shamela processing
 * Includes collection data, book content, and entry information
 * @returns Promise resolving to comprehensive data object for processing
 */
export const loadData = async () => {
    const { collectionId, from, to, ...rest } = parseInputArgs();

    const dir = path.join(OUTPUT_DIR, collectionId);
    await fs.mkdir(dir, { recursive: true });

    const collection = await loadOrDownload<Collection>('collection', async () => getCollection(collectionId), dir);

    configure({ logger });
    const book = await loadBook(collection, [from, to], dir);

    const options = await loadOptions(dir);

    return {
        book,
        collection,
        dir,
        entries: [],
        options,
        ...rest,
    };
};

/**
 * Main function to process Shamela content and generate translation prompts
 * Processes book pages, filters content based on options, and generates output files
 * @returns Promise that resolves when processing is complete
 */
export const processShamela = async () => {
    await loadData();
};
