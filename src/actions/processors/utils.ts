/**
 * A RegExp character class representing Arabic diacritics (Tashkeel/Harakat).
 * Using the '*' quantifier with this class (e.g., `DIACRITICS_CLASS*`) will match
 * zero or more diacritics.
 * Includes: Fathatan, Dammatan, Kasratan, Fatha, Damma, Kasra, Shadda, Sukun.
 */
const DIACRITICS_CLASS = '[\u064B\u064C\u064D\u064E\u064F\u0650\u0651\u0652]';

/**
 * Takes a plain Arabic string and returns a RegExp string that matches the word
 * with or without any diacritics.
 * @param text The plain Arabic text (e.g., "باب").
 * @returns A string suitable for use in a RegExp, e.g., "ب[...]ا[...]ب[...]".
 */
export const makeDiacriticInsensitive = (text: string): string => {
    // Match zero or more diacritics after each character.
    const diacriticsMatcher = `${DIACRITICS_CLASS}*`;
    return text.split('').join(diacriticsMatcher) + diacriticsMatcher;
};

export const buildDiacriticsInsensitiveExactRegex = (...args: string[]) => {
    const joined = args.map(makeDiacriticInsensitive).join('|');
    return new RegExp(`^(${joined}).*$`, 'm');
};
