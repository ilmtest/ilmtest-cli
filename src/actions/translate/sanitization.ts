import { PATTERNS } from './utils.js';

/**
 * Removes all Arabic chapter headings from translation
 * @param text
 * @returns
 */
export const removeAllArabicChaptersFromTranslation = (text: string) => {
    return text.replace(/^.*باب.*$\n?/g, '');
};

/**
 * @param text 145. It was related
 * @returns 145 - It was related
 */
export const convertNumericListToDashedInTranslation = (text: string) => {
    return text.replace(/^(\d+)\.\s+/g, '$1 -');
};

/**
 * 
 * @param text [1287]  
Among what I
 * @returns 1287 - Among what I
 */
export const convertSquareNumericListToDashedInTranslation = (text: string) => {
    return text.replace(/\[(\d+)\]\s*\n\s*/g, '$1 - ');
};

/**
 * @param text Text [4834]\nText
 * @returns Text\n4834 - Text
 */
export const convertSquareNumericListWithDashedNewLineInArabic = (text: string) => {
    return text.replace(/\[(\d{4})\]\\n/g, '\\n$1 - ');
};

/**
 * 
 * @param text Yaʿlā say:  
“‘Zāʾidah
 * @returns Yaʿlā say:  “‘Zāʾidah
 */
export const collapseTextAfterColonUntilNextNumberInTranslation = (text: string) => {
    return text.replace(/(:\s*)\n\s*(?!\d)/g, '$1: ');
};

export const removeReferencesFromBody = (text: string) => {
    return text
        .replace(PATTERNS.SquareBracketReferencesWithColon, '')
        .replace(PATTERNS.SquareBracketReferencesWithDash, '')
        .replace(PATTERNS.BodyReferences, '');
};
