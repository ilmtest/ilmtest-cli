import type { BookData, GetBookMetadataResponsePayload, Page } from 'shamela';
import type { Segment } from 'tafrigh';
import type { Entry } from './api/entries.js';
import type { CAPTURE_CONTINUOUS_PAGES, SANITIZE_HTML } from './utils/constants.js';

/**
 * Represents a collection with metadata and foreign ID references
 */
export type Collection = {
    /** Optional array of foreign ID references */
    fid?: ForeignId[];
    /** Unique identifier for the collection */
    id: string;
    /** Optional library identifier */
    library?: number;
    /** Display title of the collection */
    title: string;
};

/**
 * Configuration object containing all required API keys and service endpoints
 */
export type Config = {
    /** AWS access key for S3 operations */
    awsAccessKey: string;
    /** AWS S3 bucket name */
    awsBucket: string;
    /** AWS region for S3 operations */
    awsRegion: string;
    /** AWS secret key for S3 operations */
    awsSecretKey: string;
    /** API endpoint for collections service */
    collectionsEndpoint: string;
    /** Array of Gemini API keys for AI operations */
    geminiApiKeys: string[];
    /** API keys for Tafrigh transcription service */
    tafrighApiKeys: string;
};

/**
 * Represents a foreign ID with associated volume information
 */
export type ForeignId = {
    /** The foreign identifier (e.g., YouTube video ID) */
    id: string;
    /** Volume number associated with this ID */
    volume: number;
};

/**
 * Represents a transcript with segments, metadata, and volume information
 */
export type Transcript = {
    /** Array of transcript segments with timestamps and text */
    readonly segments: Segment[];
    /** Timestamp when the transcript was created */
    readonly timestamp: Date;
    /** Optional array of URLs associated with the transcript */
    readonly urls?: string[];
    /** Volume number this transcript belongs to */
    readonly volume: number;
};

/**
 * Represents a series of transcripts with versioning and metadata
 */
export type TranscriptSeries = {
    /** Contract version for data format compatibility */
    contractVersion: string;
    /** Timestamp when the series was created */
    createdAt: Date;
    /** Timestamp when the series was last updated */
    lastUpdatedAt: Date;
    /** Array of transcripts in this series */
    transcripts: Transcript[];
};

type SanitizeGroups = typeof SANITIZE_HTML;

export type MatnParseOptions = {
    /** How should indexed entries be parsed dashed: (8 - abcd), an Arabic abbreviation followed by a number, or in square brackets [2] Abcd  */
    numeralStrategy?: 'dashed' | 'letter' | 'square';

    /**
     * Should flatten all html tags.
     * @deprecated As of contractVersion v1.1, use sanitize = ['html'] */
    flatten?: boolean;

    /**
     * @deprecated As of contractVersion v1.1, use newChapterMarkerPattern = '^باب'
     * If there are no html tags around a line that starts with باب should we treat it as a chapter or not */
    shouldCapturePlainTextChapters?: boolean;

    /** If a chapter has <span id='toc-23'>3 - ChapterName</span> should we turn the chapter into a numbered list item */
    parseNumericChapters?: boolean;

    /** Does text span from one page to another */
    pageSpanning?: typeof CAPTURE_CONTINUOUS_PAGES | 'true';

    /** A regular expression pattern to mark the start of a new entry.
     * @deprecated As of contractVersion v1.1 Use typeToMarkerPatterns
     */
    newEntryMarkerPattern?: string;

    /**
     * Marker patterns to match a text along with the type of entry to create it as.
     * @since contractVersion v1.1
     */
    patternToType?: Record<string, number>;

    /**
     * A regular expression pattern to mark the start of a new entry iff the last entry's matn matches this pattern.
     * @since contractVersion v1.1
     */
    prevEntryMarkerPattern?: string;

    /**
     * @deprecated As of contractVersion v1.1, use newChapterMarkerPattern = '^#'
     * If there are no any text that starts with # should we parse them as chapters */
    isMarkdown?: boolean;

    /** Should we automatically attempt to fix out of order numerals indexes. */
    fix?: 'indexes';

    /** Regular expression patterns to remove from the text before processing. */
    sanitize?: Array<string | SanitizeGroups>;

    /** If this book has repeating numerals such that a numeral is not unique. If so, we */
    hasDuplicateNumerals?: boolean;

    /** Should we capture comma separated numerals (ie: 3,4,5 - Abcd) for manual post-processing. */
    captureCommaSeparatedIndices?: boolean;

    /** The delimeter to put between lines. By default it is a line break character \n. */
    lineSeparator?: string;
};

export type Excerpts = {
    /** Contract version for data format compatibility */
    contractVersion: string;

    /** Timestamp when the series was created */
    createdAt?: number;

    /** Timestamp when the series was last updated */
    lastUpdatedAt?: number;

    /** The prompt sent to the LLM to translate this. */
    prompt?: string;

    options?: MatnParseOptions;

    excerpts: Entry[];

    /**
     * @since contractVersion v1.1
     */
    collection?: Collection;
};

/**
 * Represents a translation with an identifier and translated text
 */
export type Translation = {
    /** Unique identifier for the translation */
    id: string;
    /** The translated text content */
    text: string;
};

/**
 * Represents a Shamela page with optional footer content
 */
export type ShamelaPage = Pick<Page, 'number' | 'id' | 'content'> & {
    volume: number;

    pp: number;
    /** Optional footer content for the page */
    footer?: string;
};

/**
 * Represents a complete Shamela book with metadata and pages
 */
export type ShamelaBook = Pick<BookData, 'titles'> &
    Partial<GetBookMetadataResponsePayload> & {
        /** Shamela book identifier */
        shamelaId: number;
        /** Array of book pages with content */
        pages: ShamelaPage[];
    };

export type ArabicEntry = Required<Pick<Entry, 'arabic' | 'commentary' | 'from' | 'index' | 'pp' | 'type' | 'volume'>>;
