export const OUTPUT_DIR = 'tmp';

export const CAPTURE_CONTINUOUS_PAGES = 'trailing' as const;

export const SANITIZE_HTML = 'html' as const;

/**
 * Components for building translation marker regex patterns
 */
export const TRANSLATION_MARKER_PARTS = {
    /** Dash variations (hyphen, en dash, em dash) */
    dashes: '[-–—]',
    /** Numeric portion of the reference */
    digits: '\\d+',
    /** Valid marker prefixes (Book, Chapter, Footnote, Translation, Page) */
    markers: '[BCFTPN]',
    /** Optional whitespace before dash */
    optionalSpace: '\\s?',
    /** Valid single-letter suffixes */
    suffix: '[a-z]',
};

export const MARKER_ID_PATTERN = `${TRANSLATION_MARKER_PARTS.markers}${TRANSLATION_MARKER_PARTS.digits}${TRANSLATION_MARKER_PARTS.suffix}?`;

export const ORIGINAL_ELLIPSIS = /\.\.\.$/;