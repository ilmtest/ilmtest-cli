/**
 * Arabic diacritics (Tashkeel/Harakat).
 */
const DIACRITICS_CLASS = '[\u064B\u064C\u064D\u064E\u064F\u0650\u0651\u0652]';

/**
 * Groups of equivalent Arabic characters — any character in a group should match
 * any other character in the same group.
 */
const EQUIV_GROUPS: string[][] = [
    ['\u0627', '\u0622', '\u0623', '\u0625'], // ا, آ, أ, إ
    ['\u0629', '\u0647'], // ة <-> ه
    ['\u0649', '\u064A'], // ى <-> ي
];

/** Escape regex special characters (if the search word contains punctuation). */
const escapeForRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Return a character class for a char if it belongs to an equivalence group. */
const getEquivClass = (ch: string): string => {
    for (const group of EQUIV_GROUPS) {
        if (group.includes(ch)) {
            // join the group's members into a character class
            return `[${group.map((c) => escapeForRegex(c)).join('')}]`;
        }
    }
    // not in equivalence groups -> return escaped character
    return escapeForRegex(ch);
};

/** Small safe normalization: NFC, remove ZWJ/ZWNJ, collapse spaces. */
const normalizeArabicLight = (str: string) =>
    str
        .normalize('NFC')
        .replace(/[\u200C\u200D]/g, '') // remove ZWJ/ZWNJ
        .replace(/\s+/g, ' ')
        .trim();

/** Build the diacritic-insensitive fragment for a word. */
const makeDiacriticInsensitive = (text: string): string => {
    const diacriticsMatcher = `${DIACRITICS_CLASS}*`;
    const norm = normalizeArabicLight(text);
    // Use Array.from to iterate grapheme-safe over the string (works fine for Arabic letters)
    return Array.from(norm)
        .map((ch) => getEquivClass(ch) + diacriticsMatcher)
        .join('');
};

/**
 * Build a regex that matches any of the provided Arabic words at the start of a line,
 * ignoring diacritics and common letter variants.
 */
export const buildDiacriticsInsensitiveExactRegex = (...words: string[]) => {
    const pattern = words.map(makeDiacriticInsensitive).join('|');
    return new RegExp(`^(?:${pattern}) .*$`, 'm');
};
