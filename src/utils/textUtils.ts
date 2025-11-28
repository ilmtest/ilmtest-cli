import { removeFootnoteReferencesSimple, removeSingleDigitFootnoteReferences, sanitizeArabic } from 'baburchi';
import {
    condenseEllipsis,
    makeDiacriticInsensitive,
    makeDiacriticInsensitiveRegex,
    normalizeSpaces,
} from 'bitaboom';
import {
    removeArabicNumericPageMarkers,
    //removeTagsExceptSpan,
    sanitizePageContent,
    splitPageBodyFromFooter,
} from 'shamela';
import type { MarkerConfig, NumberingStyle, SeparatorStyle } from '@/types.js';

/**
 *
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

export const COMMON_PATTERNS = {
    BAB: makeDiacriticInsensitiveRegex('باب').source,
    KITAB: makeDiacriticInsensitiveRegex('كتاب').source,
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

