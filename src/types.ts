import type { BookData, GetBookMetadataResponsePayload, Page, Title } from 'shamela';
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

export type PatternOptions = {
    minPage?: number;
    type?: number;
    [key: string]: any;
};

export type HeadingOptions = {
    /**
     * Preprocessing replacements to make before sending to prompt.
     * @since contractVersion v1.2
     */
    preprompt?: Record<string, string>;
};



export type MatnParseOptions = {
    /**
     * How should indexed entries be parsed dashed: (8 - abcd), an Arabic abbreviation followed by a number, or in square brackets [2] Abcd
     * @deprecated since contractVersion v1.2 just use patternToOptions and do post-processing.
     */
    numeralStrategy?: 'dashed' | 'letter' | 'square';

    /**
     * Marks the very first page from which entry indexes should be considered to be added. Otherwise we will just assume they are part of the paragraph text.
     * @since contractVersion v1.1
     * @deprecated since contractVersion v1.2 Use
     */
    firstPageWithIndex?: number;

    /**
     * Should flatten all html tags.
     * @deprecated As of contractVersion v1.1, use sanitize = ['html'] */
    flatten?: boolean;

    /**
     * If this is truthy we will capture footnotes.
     * @since contractVersion v1.2
     */
    footnotes?: boolean;

    /**
     * Options for processing headings.
     * @since contractVersion v1.2
     */
    headings?: HeadingOptions;

    /**
     * Surgical patches for the book which has typos.
     * @since contractVersion v1.2
     */
    aslPatches?: Array<{ page: number; match: string; replacement: string }>;

    /**
     * Removes all pages that matches this pattern.
     * @since contractVersion v1.2
     * @deprecated since contractVersion v2.0, use excludePagesWithPatterns
     */
    removePagesWithPattern?: string;

    /**
     * Removes all pages that match any of these patterns, it'll be concatenated using a | in the final Regex.
     * @since contractVersion v1.2
     */
    excludePagesWithPatterns?: string[];

    /**
     * Filters out these page ranges.
     * @since contractVersion v1.2
     */
    excludePages?: string[];

    /**
     * @deprecated As of contractVersion v1.1, use newChapterMarkerPattern = '^باب'
     * If there are no html tags around a line that starts with باب should we treat it as a chapter or not */
    shouldCapturePlainTextChapters?: boolean;

    /** If a chapter has <span id='toc-23'>3 - ChapterName</span> should we turn the chapter into a numbered list item */
    parseNumericChapters?: boolean;

    /**
     * Does text span from one page to another
     * @deprecated as of v2.0, use overflow.
     */
    pageSpanning?: typeof CAPTURE_CONTINUOUS_PAGES | 'true';

    /**
     * Controls how text overflow is handled at page breaks.
     * - `punctuation`: Cut off text at the last punctuation mark
     * - `next`: Continue text until the next pattern marker.
     * @since v2.0
     */
    overflow?: 'punctuation' | 'next';

    /** A regular expression pattern to mark the start of a new entry.
     * @deprecated As of contractVersion v1.1 Use typeToMarkerPatterns
     */
    newEntryMarkerPattern?: string;

    /**
     * Marker patterns to match a text along with the type of entry to create it as.
     * @since contractVersion v1.1
     * @deprecated since contractVersion v1.2, use patternToOptions instead.
     */
    patternToType?: Record<string, number>;

    /**
     * @since contractVersion v1.2
     */
    patternToOptions?: Record<string, PatternOptions>;

    /**
     * A regular expression pattern to mark the start of a new entry iff the last entry's matn matches this pattern.
     * @since contractVersion v1.1
     */
    prevEntryMarkerPattern?: string;

    /**
     * If there are no any text that starts with # should we parse them as chapters */
    isMarkdown?: boolean;

    /**
     * Should we automatically attempt to fix out of order numerals indexes.
     * @deprecated since contractVersion v2.0, this is now done in a post-processing step.
     */
    fix?: 'indexes';

    /**
     * Regular expression patterns to remove from the text before processing.
     *
     * @deprecated since contractVersion v1.2 Use replacements.
     */
    sanitize?: Array<string | SanitizeGroups>;

    /**
     * Preprocessing replacements to make.
     * @since contractVersion 1.2
     */
    replacements?: Record<string, string>;

    /**
     * Preprocessing replacements to make before sending to prompt.
     * @since contractVersion v1.2
     */
    preprompt?: Record<string, string>;

    /** If this book has repeating numerals such that a numeral is not unique.
     * @deprecated since contractVersion v1.2
     */
    hasDuplicateNumerals?: boolean;

    /**
     * Should we capture comma separated numerals (ie: 3,4,5 - Abcd) for manual post-processing.
     * @deprecated since contractVersion v1.2, use patternToOptions
     */
    captureCommaSeparatedIndices?: boolean;

    /** The delimeter to put between lines. By default it is a line break character \n. */
    lineSeparator?: string;

    /**
     * List of markers to identify new entries.
     * @since contractVersion v2.1
     */
    markers?: MarkerConfig[];

    /**
     * Global exclude patterns (replacing excludePagesWithPatterns).
     * @since contractVersion v2.1
     */
    excludePatterns?: string[];
};

export type NumberingStyle = 'arabic-indic' | 'latin';
export type SeparatorStyle = 'dash' | 'dot' | 'paren' | 'colon' | 'none';

/**
 * Modifier for numbered markers to handle common variations
 */
export type NumberedModifier = 
    | 'with-letter'      // ٥ أ - (numeral + Arabic letter + separator)
    | 'with-slash'       // ٥/٦ - (numeral/numeral + separator)
    | 'with-parentheses' // ٥ (أ) - (numeral with parenthetical content)
    | 'bullet-prefix';   // • ٥ - (bullet followed by numeral)

export type MarkerType = 
    | 'numbered'
    | 'bullet'
    | 'heading'
    | 'pattern'          // Custom pattern (renamed from 'custom')
    // Preset types for common Arabic text patterns:
    | 'bab'              // باب chapter markers
    | 'hadith-chain'     // Hadith narrator chain patterns
    | 'basmala'          // بسم الله patterns
    | 'phrase'           // Configurable phrase starters
    | 'square-bracket'   // [number] reference patterns
    // Numbered marker variants (common patterns):
    | 'num-letter'       // ٥ أ - (number + Arabic letter + dash)
    | 'num-paren'        // ٥ (أ) - (number + parenthetical + dash)
    | 'num-slash';       // ٥/٦ - (number / number + dash)

export type MarkerConfig = {
    /** The type of marker to look for */
    type: MarkerType;
    /** For numbered markers, the digit style */
    numbering?: NumberingStyle;
    /** The separator that follows the marker */
    separator?: SeparatorStyle | string;
    /**
     * Template format for numbered markers using token syntax.
     * Replaces the old 'modifier' field with readable templates.
     * Example: '{bullet}+ {num} {dash}' instead of modifier: 'bullet-prefix'
     * Only valid when type is 'numbered'.
     */
    format?: string;
    /**
     * For 'pattern' type, provide a template using tokens like {num}, {dash}, {bullet}.
     * This is more readable than raw regex patterns.
     * Example: '{bullet}? {num}+ {s}{dash}' instead of '^[•*°]? ([\\u0660-\\u0669]+\\s?[-–—ـ].*)'
     */
    template?: string;
    /**
     * Custom token map for advanced users.
     * Extends the default TOKENS with additional definitions.
     */
    tokens?: Record<string, string>;
    /**
     * List of phrases for 'phrase' and 'hadith-chain' types.
     * For 'hadith-chain', defaults to common narrator patterns if not provided.
     */
    phrases?: string[];
    /** Optional: Only apply this marker after a specific page number */
    minPage?: number;
    /** Optional: The entry type this marker signifies (default: 0/Text) */
    entryType?: number;
    /**
     * Optional: Arbitrary metadata to attach to the created entry.
     * This allows for agnostic handling of entry properties.
     */
    metadata?: Record<string, any>;
    /**
     * If true, this marker is automatically removed from the text content.
     * Replaces the need for 'preprompt' entries for this pattern.
     * Default: true for 'numbered', 'bullet', 'square-bracket'; false for preset types
     */
    removeMarker?: boolean;
    /**
     * DEPRECATED: Use 'template' instead.
     * Raw regex pattern for 'pattern' type.
     */
    pattern?: string;
    /**
     * DEPRECATED: Use 'format' instead.
     * Old modifier syntax for numbered markers.
     */
    modifier?: NumberedModifier;
};

export type SegmentationConfig = {
    /** List of markers to identify new entries */
    markers: MarkerConfig[];
    /**
     * Global exclude patterns (replacing excludePagesWithPatterns).
     * Can use presets like 'headers', 'footers' or raw regex.
     */
    excludePatterns?: string[];
} & Pick<MatnParseOptions, 'overflow' | 'aslPatches' | 'excludePages' | 'footnotes' | 'headings' | 'isMarkdown' | 'lineSeparator' | 'replacements'>;

export type Heading = {
    nass: string;
    text?: string;
    from: number;
    id: string;
    parent?: number;
    translator?: number;

    /** Timestamp when the series was last updated */
    lastUpdatedAt?: number;
};

export type Footnote = {
    nass: string;
    from: number;
    id: string;
    text?: string;
    translator?: number;

    /** Timestamp when the series was last updated */
    lastUpdatedAt?: number;
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
     * @since contractVersion v1.2
     */
    headings: Heading[];

    /**
     * Footnotes.
     * @since contractVersion v1.2
     */
    footnotes: Footnote[];

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
