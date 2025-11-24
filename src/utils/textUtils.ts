import { removeFootnoteReferencesSimple, removeSingleDigitFootnoteReferences, sanitizeArabic } from 'baburchi';
import { condenseEllipsis, normalizeSpaces } from 'bitaboom';
import {
    removeArabicNumericPageMarkers,
    //removeTagsExceptSpan,
    sanitizePageContent,
    splitPageBodyFromFooter,
} from 'shamela';

/**
 * Regular expression patterns for text processing, particularly for Arabic and numeric content
 */
export const PATTERNS = {
    /** Matches text ending with Arabic-Indic digits (٠-٩) */
    EndsWithNumber: /[\u0660-\u0669]$/,
    /** Matches Arabic numeric list items (e.g., "١- item text") */
    MatchArabicNumericListItem: /^([\u0660-\u0669]+)\s?[-–—ـ](.*)/,
    /** Matches numbered paragraphs with Latin numerals (e.g., "1 - paragraph text") */
    MatchNumberedParagraph: /^(\d+)\s+[-–—ـ]\s+(.*)$/gm,
    /** Matches numeric list items with Latin numerals (e.g., "1- item text") */
    MatchNumericListItem: /^(\d+)\s?[-–—ـ](.*)/,
    /** Matches parenthesized Arabic-Indic numbers (e.g., "(١)") */
    MatchRoundArabicNumericItem: /^\(([\u0660-\u0669]+)\)$/,
};

/**
 * Components for building translation marker regex patterns
 */
const TRANSLATION_MARKER_PARTS = {
    /** Dash variations (hyphen, en dash, em dash) */
    dashes: '[-–—]',
    /** Numeric portion of the reference */
    digits: '\\d+',
    /** Valid marker prefixes (Book, Chapter, Footnote, Translation, Page) */
    markers: '[BCFTP]',
    /** Optional whitespace before dash */
    optionalSpace: '\\s?',
    /** Valid single-letter suffixes */
    suffix: '[a-j]',
};

/**
 * Builds a regex pattern string for translation markers
 */
const buildMarkerPattern = ({
    anchor = '',
    prefix = '',
    markers = TRANSLATION_MARKER_PARTS.markers,
    digits = TRANSLATION_MARKER_PARTS.digits,
    suffix = '',
    space = '',
    dash = '',
    postfix = '',
}: {
    anchor?: string;
    prefix?: string;
    markers?: string;
    digits?: string;
    suffix?: string;
    space?: string;
    dash?: string;
    postfix?: string;
}) => {
    return `${anchor}${prefix}${markers}${digits}${suffix}${space}${dash}${postfix}`;
};

const removeTagsExceptSpan = (content: string) => {
    // Remove <a> tags and their content, keeping only the text inside
    content = content.replace(/<a[^>]*>(.*?)<\/a>/gs, '$1');

    // Remove <hadeeth> tags (both self-closing, with content, and numbered)
    content = content.replace(/<hadeeth[^>]*>|<\/hadeeth>|<hadeeth-\d+>/gs, '');

    return content;
};

export const mapPatternsToFormatters = (patternToReplacement: Record<string, string>) => {
    const formatters = Object.entries(patternToReplacement).map(([pattern, replacement]) => {
        const regex = new RegExp(pattern, 'g');

        return (text: string) => {
            return text.replace(regex, replacement);
        };
    });

    return formatters;
};

export const getPageBodyAndFootnotes = (text: string) => {
    let [content, footnote = ''] = splitPageBodyFromFooter(text);

    content = removeSingleDigitFootnoteReferences(content);
    //content = sanitizeArabic(content);

    //content = content.replace(/<man[^>]*>|<\/man>|<man-\d+>/g, '');
    content = removeTagsExceptSpan(content);
    content = condenseEllipsis(content);
    content = removeFootnoteReferencesSimple(content);
    content = removeArabicNumericPageMarkers(content);
    //content = content.replace(/\s?⦗[\u0660-\u0669]+⦘\s?/g, ' ');
    content = sanitizePageContent(content);
    content = normalizeSpaces(content);

    footnote = sanitizePageContent(footnote);

    return [content, footnote];
};

const blacklistRegex = new RegExp(
    ['صلي الله عليه وسلم', 'رضي الله عنهما', 'رضي الله عنه'].sort((a, b) => b.length - a.length).join('|'),
);

export const sanitizeChapter = (title: string) => {
    return sanitizeArabic(title, 'aggressive')
        .replace(blacklistRegex, '')
        .replace(/^باب/, '')
        .replace(/^كتاب/, '')
        .trim();
};

export const validateTranslationMarkers = (text: string) => {
    const { markers, digits, suffix, dashes, optionalSpace } = TRANSLATION_MARKER_PARTS;

    // Check for invalid reference format (with dash but wrong structure)
    // This catches cases like B12a34 -, P1x2y3 -, P2247$2 -, etc.
    // Uses negative lookahead to exclude valid formats
    // Pattern: marker followed by (has dash ahead) AND (NOT valid format) AND (non-space/dash chars) AND (space?) AND (dash)
    const invalidRefPattern = new RegExp(
        `^${markers}(?=.*${dashes})(?!${digits}${suffix}*${optionalSpace}${dashes})[^\\s-–—]+${optionalSpace}${dashes}`,
        'm',
    );
    const invalidRef = text.match(invalidRefPattern);

    if (invalidRef) {
        return `Error in text: invalid reference format "${invalidRef[0].trim()}" - expected format is letter + numbers + optional suffix (a-j) + dash`;
    }

    // Check for space before reference with multi-letter suffix
    const spaceBeforePattern = new RegExp(
        buildMarkerPattern({
            dash: dashes,
            digits,
            markers,
            prefix: ' ',
            space: optionalSpace,
            suffix: `${suffix}+`,
        }),
        'm',
    );

    // Check for reference with single letter suffix but no dash after
    const suffixNoDashPattern = new RegExp(
        buildMarkerPattern({
            anchor: '^',
            digits,
            markers,
            postfix: `(?! ${dashes})`,
            suffix,
        }),
        'm',
    );

    const match = text.match(spaceBeforePattern) || text.match(suffixNoDashPattern);

    if (match) {
        return `Error in text: found "${match[0]}"`;
    }

    // Check for references with dash but no content after
    const emptyAfterDashPattern = new RegExp(
        buildMarkerPattern({
            anchor: '^',
            dash: dashes,
            digits,
            markers,
            postfix: '\\s*$',
            space: optionalSpace,
            suffix: `${suffix}*`,
        }),
        'm',
    );
    const emptyAfterDash = text.match(emptyAfterDashPattern);

    if (emptyAfterDash) {
        return `Error in text: reference "${emptyAfterDash[0].trim()}" has dash but no content after it`;
    }

    // Check for $ character in references without dash (invalid format like B1234$5)
    // This is checked last since references with dash are caught by invalidRef check above
    const dollarSignPattern = new RegExp(
        buildMarkerPattern({
            anchor: '^',
            digits,
            markers,
            postfix: `\\$${digits}`,
        }),
        'm',
    );
    const dollarSignRef = text.match(dollarSignPattern);

    if (dollarSignRef) {
        return `Error in text: invalid reference format "${dollarSignRef[0]}" - contains $ character`;
    }
};
