import { makeDiacriticInsensitive } from 'bitaboom';

/**
 * Build a regex that matches any of the provided Arabic words at the start of a line,
 * ignoring diacritics and common letter variants.
 */
export const buildDiacriticsInsensitiveExactRegex = (...words: string[]) => {
    const pattern = words.map(makeDiacriticInsensitive).join('|');
    return new RegExp(`^(?:${pattern}) .*$`, 'm');
};
