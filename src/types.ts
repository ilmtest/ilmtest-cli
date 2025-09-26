import type { BookData, GetBookMetadataResponsePayload, Page } from 'shamela';
import type { Segment } from 'tafrigh';
import type { Entry } from './api/entries.js';

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
