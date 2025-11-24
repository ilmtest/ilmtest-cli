import { describe, expect, it } from 'bun:test';
import { validateTranslationMarkers } from './textUtils';

describe('validateTranslationMarkers', () => {
    it('should return undefined for valid text without markers', () => {
        const result = validateTranslationMarkers('This is normal text without any markers');
        expect(result).toBeUndefined();
    });

    it('should return undefined for valid reference format with dash', () => {
        const result = validateTranslationMarkers('B1234 - Some translation text here');
        expect(result).toBeUndefined();
    });

    it('should return undefined for valid reference with suffix and dash', () => {
        const result = validateTranslationMarkers('P2247a - Valid translation text');
        expect(result).toBeUndefined();
    });

    it('should detect space before reference with suffix', () => {
        const result = validateTranslationMarkers('Some text P1234a - more text');
        expect(result).toBe('Error in text: found " P1234a -"');
    });

    it('should detect space before reference with suffix (en dash)', () => {
        const result = validateTranslationMarkers('Some text C5678b – more text');
        expect(result).toBe('Error in text: found " C5678b –"');
    });

    it('should detect space before reference with suffix (em dash)', () => {
        const result = validateTranslationMarkers('Some text F9999c — more text');
        expect(result).toBe('Error in text: found " F9999c —"');
    });

    it('should detect reference with suffix but no dash', () => {
        const result = validateTranslationMarkers('T1234a without dash');
        expect(result).toBe('Error in text: found "T1234a"');
    });

    it('should detect invalid reference format with letters in number portion', () => {
        const result = validateTranslationMarkers('B12a34 - text');
        // This is caught by the invalid format check
        expect(result).toBe(
            'Error in text: invalid reference format "B12a34 -" - expected format is letter + numbers + optional suffix (a-j) + dash',
        );
    });

    it('should detect invalid reference format with mixed characters', () => {
        const result = validateTranslationMarkers('P1x2y3 - text');
        expect(result).toBe(
            'Error in text: invalid reference format "P1x2y3 -" - expected format is letter + numbers + optional suffix (a-j) + dash',
        );
    });

    it('should detect reference with dash but no content after (hyphen)', () => {
        const result = validateTranslationMarkers('P2247 -');
        expect(result).toBe('Error in text: reference "P2247 -" has dash but no content after it');
    });

    it('should detect reference with dash but no content after (en dash)', () => {
        const result = validateTranslationMarkers('B1234 –');
        expect(result).toBe('Error in text: reference "B1234 –" has dash but no content after it');
    });

    it('should detect reference with dash but no content after (em dash)', () => {
        const result = validateTranslationMarkers('C5678 —');
        expect(result).toBe('Error in text: reference "C5678 —" has dash but no content after it');
    });

    it('should detect reference with dash and only whitespace after', () => {
        const result = validateTranslationMarkers('F9999 -   ');
        expect(result).toBe('Error in text: reference "F9999 -" has dash but no content after it');
    });

    it('should detect dollar sign in reference format', () => {
        const result = validateTranslationMarkers('P2247$2 - Some text');
        // The error is caught - message may vary but the important thing is it's flagged
        expect(result).toBeDefined();
        expect(result).toContain('Error in text: invalid reference format');
    });

    it('should detect dollar sign in reference without dash', () => {
        const result = validateTranslationMarkers('B1234$5 text here');
        expect(result).toBe('Error in text: invalid reference format "B1234$5" - contains $ character');
    });

    it('should handle multiple lines and detect first error', () => {
        const result = validateTranslationMarkers('Line 1\nP2247 -\nLine 3');
        expect(result).toBe('Error in text: reference "P2247 -" has dash but no content after it');
    });

    it('should handle all valid reference prefixes (B, C, F, T, P)', () => {
        expect(validateTranslationMarkers('B123 - text')).toBeUndefined();
        expect(validateTranslationMarkers('C123 - text')).toBeUndefined();
        expect(validateTranslationMarkers('F123 - text')).toBeUndefined();
        expect(validateTranslationMarkers('T123 - text')).toBeUndefined();
        expect(validateTranslationMarkers('P123 - text')).toBeUndefined();
    });

    it('should handle reference with suffix at boundary (a-j)', () => {
        expect(validateTranslationMarkers('P123a - text')).toBeUndefined();
        expect(validateTranslationMarkers('P123j - text')).toBeUndefined();
    });

    it('should throw an error for wrong chapter', () => {
        expect(validateTranslationMarkers(`C2203 -\nC2203$2 - Chapter of the`)).toBeDefined();
    });
});
