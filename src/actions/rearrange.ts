import { removeSingleDigitReferences } from 'bitaboom';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { getPages, type Page } from '@/api/maktabah.js';
import { OUTPUT_DIR } from '@/utils/constants.js';

import { loadOrDownload } from '..//utils/network.js';
import { Entry, getEntries } from '../api/entries.js';
import { removeFootnotesFromPages } from './translate/transform.js';

/**
 * Calculates similarity percentage between two strings based on Levenshtein distance
 */
function calculateSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1.0;
    if (!str1 || !str2) return 0.0;

    const maxLength = Math.max(str1.length, str2.length);
    const distance = levenshteinDistance(str1, str2);

    return (maxLength - distance) / maxLength;
}

/**
 * Determines if two Arabic strings are similar based on a threshold
 * @param text1 - First Arabic text
 * @param text2 - Second Arabic text
 * @param threshold - Similarity threshold (0.0 to 1.0, where 1.0 is identical)
 * @returns true if similarity is above threshold, false otherwise
 */
function isSimilar(normalized1: string, normalized2: string, threshold: number = 0.8): boolean {
    // Validate threshold
    if (threshold < 0 || threshold > 1) {
        throw new Error('Threshold must be between 0.0 and 1.0');
    }

    // Handle empty strings
    if (!normalized1 && !normalized2) return true;
    if (!normalized1 || !normalized2) return false;

    // Calculate similarity
    const similarity = calculateSimilarity(normalized1, normalized2);

    return similarity >= threshold;
}

/**
 * Calculates the Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    // Initialize first row and column
    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }

    // Fill the matrix
    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1, // insertion
                    matrix[i - 1][j] + 1, // deletion
                );
            }
        }
    }

    return matrix[str2.length][str1.length];
}

/**
 * Normalizes Arabic text by removing everything except Arabic letters
 * Removes: digits, symbols, diacritics (tashkeel), tatweel, punctuation, etc.
 * Keeps only: Arabic letters (ا-ي and ء)
 */
function normalizeArabicText(text: string): string {
    if (!text) return '';

    // Remove all characters except Arabic letters
    // Arabic letter ranges:
    // \u0621-\u063A: Basic Arabic letters (ء to غ)
    // \u0641-\u064A: Basic Arabic letters (ف to ي)
    // \u067E-\u0686: Additional letters like پ, ت, ج (for Persian/Urdu compatibility)
    // \u06A4-\u06AF: Additional letters
    // \u06CC-\u06D3: Additional letters like ی
    const arabicLettersOnly = text.replace(/[^\u0621-\u063A\u0641-\u064A\u067E\u0686\u06A4\u06AF\u06CC\u06D3]/g, '');

    // Remove extra whitespace and trim
    return arabicLettersOnly.replace(/\s+/g, ' ').trim();
}

export const rearrangeEntries = async (collectionId: string) => {
    const dir = path.join(OUTPUT_DIR, collectionId);
    await fs.mkdir(dir, { recursive: true });

    let pages = await loadOrDownload<Page>(
        'pages',
        async () => {
            const result = await getPages(collectionId);
            return result;
        },
        dir,
    );
    pages = removeFootnotesFromPages(pages);
    pages = pages.map((p) => ({
        ...p,
        body: removeSingleDigitReferences(p.body),
    }));

    const entries = await loadOrDownload<Entry>(
        'entries',
        async () => {
            const result = await getEntries(collectionId, { full: 1, limit: -1 });
            return result;
        },
        dir,
    );

    const normalizedPages = pages.map((p) => {
        return { ...p, normalized: normalizeArabicText(p.body) };
    });

    let count = 0;

    for (const entry of entries) {
        const arabic = normalizeArabicText(entry.arabic!);

        const matchedPage = normalizedPages.find((p) => {
            return isSimilar(arabic, p.normalized);
        });

        if (matchedPage) {
            if (entry.from !== matchedPage.page) {
                console.log(entry.id, 'needs to be linked to', matchedPage.page);
                ++count;
            }
        } else {
            console.warn('Match NOT found for', entry.id);
        }

        if (count === 15) {
            break;
        }
    }
};
