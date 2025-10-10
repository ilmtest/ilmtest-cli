import { removeFootnoteReferencesSimple, removeSingleDigitFootnoteReferences, sanitizeArabic } from 'baburchi';
import { condenseEllipsis, normalizeSpaces } from 'bitaboom';
import {
    removeArabicNumericPageMarkers,
    removeTagsExceptSpan,
    sanitizePageContent,
    splitPageBodyFromFooter,
} from 'shamela';

/**
 * Regular expression patterns for text processing, particularly for Arabic and numeric content
 */
export const PATTERNS = {
    /** Matches text ending with Arabic-Indic digits (٠-٩) */
    EndsWithNumber: /[\u0660-\u0669]$/,
    /** Matches text ending with common punctuation marks */
    EndsWithPunctuation: /[.!?؟؛…]$/,
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
 * Finds the position of the last punctuation character in a string
 *
 * @param text - The text to search through
 * @returns The index of the last punctuation character, or -1 if none found
 *
 * @example
 * ```typescript
 * const text = "Hello world! How are you?";
 * const lastPuncIndex = findLastPunctuation(text);
 * // Result: 24 (position of the last '?')
 *
 * const noPuncText = "Hello world";
 * const notFound = findLastPunctuation(noPuncText);
 * // Result: -1 (no punctuation found)
 * ```
 */
export const findLastPunctuation = (text: string) => {
    for (let i = text.length - 1; i >= 0; i--) {
        if (PATTERNS.EndsWithPunctuation.test(text[i])) {
            return i;
        }
    }

    return -1;
};

export const removeAllTags = (content: string) => content.replace(/<[^>]*>/g, '');

export const getPageBodyAndFootnotes = (text: string) => {
    const [body, footnote] = splitPageBodyFromFooter(text);

    let content = body;
    content = removeSingleDigitFootnoteReferences(content);
    content = removeTagsExceptSpan(content);
    content = condenseEllipsis(content);
    //content = removeAllTags(content);
    content = removeFootnoteReferencesSimple(content);
    content = removeArabicNumericPageMarkers(content);
    content = sanitizePageContent(content);
    content = normalizeSpaces(content);

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
