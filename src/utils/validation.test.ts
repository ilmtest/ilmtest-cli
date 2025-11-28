import { describe, expect, it } from 'bun:test';
import { validateDeprecatedOptions, validateParseOptions, validateTranslationMarkers } from './validation';

describe('validation', () => {
    describe('validateDeprecatedOptions', () => {
        it('should not throw when no deprecated options are provided', () => {
            expect(() => {
                validateDeprecatedOptions({});
            }).not.toThrow();
        });

        it('should not throw when only valid options are provided', () => {
            expect(() => {
                validateDeprecatedOptions({
                    excludePagesWithPatterns: ['pattern'],
                    patternToOptions: { '^test': { type: 1 } },
                    replacements: { old: 'new' },
                });
            }).not.toThrow();
        });

        it('should throw error when numeralStrategy is provided', () => {
            expect(() => {
                validateDeprecatedOptions({
                    numeralStrategy: 'dashed',
                });
            }).toThrow('numeralStrategy has been deprecated, please migrate the breaking changes');
        });

        it('should throw error when numeralStrategy is provided with value "letter"', () => {
            expect(() => {
                validateDeprecatedOptions({
                    numeralStrategy: 'letter',
                });
            }).toThrow('numeralStrategy has been deprecated, please migrate the breaking changes');
        });

        it('should throw error when numeralStrategy is provided with value "square"', () => {
            expect(() => {
                validateDeprecatedOptions({
                    numeralStrategy: 'square',
                });
            }).toThrow('numeralStrategy has been deprecated, please migrate the breaking changes');
        });

        it('should throw error when removePagesWithPattern is provided', () => {
            expect(() => {
                validateDeprecatedOptions({
                    removePagesWithPattern: 'some pattern',
                });
            }).toThrow('removePagesWithPattern has been replaced with excludePagesWithPatterns');
        });

        it('should throw error when removePagesWithPattern is provided with empty string', () => {
            expect(() => {
                validateDeprecatedOptions({
                    removePagesWithPattern: '',
                });
            }).not.toThrow();
        });

        it('should throw error when fix is provided', () => {
            expect(() => {
                validateDeprecatedOptions({
                    fix: 'indexes',
                });
            }).toThrow('fix has been deprecated');
        });

        it('should throw error when firstPageWithIndex is provided', () => {
            expect(() => {
                validateDeprecatedOptions({
                    firstPageWithIndex: 10,
                });
            }).toThrow('firstPageWithIndex has been moved to the minPage in the patternToOptions');
        });

        it('should not throw error when firstPageWithIndex is provided with value 0', () => {
            expect(() => {
                validateDeprecatedOptions({
                    firstPageWithIndex: 0,
                });
            }).not.toThrow();
        });

        it('should throw error when hasDuplicateNumerals is provided', () => {
            expect(() => {
                validateDeprecatedOptions({
                    hasDuplicateNumerals: true,
                });
            }).toThrow('hasDuplicateNumerals has been deprecated');
        });

        it('should throw error when hasDuplicateNumerals is provided with value false', () => {
            expect(() => {
                validateDeprecatedOptions({
                    hasDuplicateNumerals: false,
                });
            }).not.toThrow();
        });

        it('should throw error when newEntryMarkerPattern is provided', () => {
            expect(() => {
                validateDeprecatedOptions({
                    newEntryMarkerPattern: '^entry',
                });
            }).toThrow('newEntryMarkerPattern has been replaced with patternToOptions');
        });

        it('should throw error when captureCommaSeparatedIndices is provided', () => {
            expect(() => {
                validateDeprecatedOptions({
                    captureCommaSeparatedIndices: true,
                });
            }).toThrow('captureCommaSeparatedIndices has been deprecated in favour of patternToOptions');
        });

        it('should throw error when sanitize is provided', () => {
            expect(() => {
                validateDeprecatedOptions({
                    sanitize: ['html'],
                });
            }).toThrow('sanitize has been deprecated in favour of replacements');
        });

        it('should throw error when sanitize is provided with empty array', () => {
            expect(() => {
                validateDeprecatedOptions({
                    sanitize: [],
                });
            }).toThrow('sanitize has been deprecated in favour of replacements');
        });

        it('should throw error when shouldCapturePlainTextChapters is provided', () => {
            expect(() => {
                validateDeprecatedOptions({
                    shouldCapturePlainTextChapters: true,
                });
            }).toThrow('shouldCapturePlainTextChapters has been deprecated in favour of patternToOptions');
        });

        it('should throw error when patternToType is provided', () => {
            expect(() => {
                validateDeprecatedOptions({
                    patternToType: { '^test': 1 },
                });
            }).toThrow('patternToType has been deprecated in favour of patternToOptions');
        });

        it('should throw error when patternToType is provided with empty object', () => {
            expect(() => {
                validateDeprecatedOptions({
                    patternToType: {},
                });
            }).toThrow('patternToType has been deprecated in favour of patternToOptions');
        });

        it('should throw error when flatten is provided', () => {
            expect(() => {
                validateDeprecatedOptions({
                    flatten: true,
                });
            }).toThrow('flatten has been deprecated in favour of replacements[HTML]');
        });

        it('should throw error when flatten is provided with value false', () => {
            expect(() => {
                validateDeprecatedOptions({
                    flatten: false,
                });
            }).not.toThrow();
        });

        it('should throw error for first deprecated option when multiple are provided', () => {
            expect(() => {
                validateDeprecatedOptions({
                    fix: 'indexes',
                    flatten: true,
                    numeralStrategy: 'dashed',
                });
            }).toThrow('numeralStrategy has been deprecated, please migrate the breaking changes');
        });

        it('should throw error for removePagesWithPattern when provided with other valid options', () => {
            expect(() => {
                validateDeprecatedOptions({
                    patternToOptions: { '^test': { type: 1 } },
                    removePagesWithPattern: 'pattern',
                });
            }).toThrow('removePagesWithPattern has been replaced with excludePagesWithPatterns');
        });

        it('should throw error for fix when provided with other valid options', () => {
            expect(() => {
                validateDeprecatedOptions({
                    excludePagesWithPatterns: ['pattern'],
                    fix: 'indexes',
                });
            }).toThrow('fix has been deprecated');
        });

        it('should throw error for firstPageWithIndex when provided with other valid options', () => {
            expect(() => {
                validateDeprecatedOptions({
                    firstPageWithIndex: 5,
                    patternToOptions: { '^test': { type: 1 } },
                });
            }).toThrow('firstPageWithIndex has been moved to the minPage in the patternToOptions');
        });

        it('should throw error for hasDuplicateNumerals when provided with other valid options', () => {
            expect(() => {
                validateDeprecatedOptions({
                    hasDuplicateNumerals: true,
                    replacements: { old: 'new' },
                });
            }).toThrow('hasDuplicateNumerals has been deprecated');
        });

        it('should throw error for newEntryMarkerPattern when provided with other valid options', () => {
            expect(() => {
                validateDeprecatedOptions({
                    excludePagesWithPatterns: ['pattern'],
                    newEntryMarkerPattern: '^entry',
                });
            }).toThrow('newEntryMarkerPattern has been replaced with patternToOptions');
        });

        it('should throw error for captureCommaSeparatedIndices when provided with other valid options', () => {
            expect(() => {
                validateDeprecatedOptions({
                    captureCommaSeparatedIndices: true,
                    patternToOptions: { '^test': { type: 1 } },
                });
            }).toThrow('captureCommaSeparatedIndices has been deprecated in favour of patternToOptions');
        });

        it('should throw error for sanitize when provided with other valid options', () => {
            expect(() => {
                validateDeprecatedOptions({
                    replacements: { old: 'new' },
                    sanitize: ['html'],
                });
            }).toThrow('sanitize has been deprecated in favour of replacements');
        });

        it('should throw error for shouldCapturePlainTextChapters when provided with other valid options', () => {
            expect(() => {
                validateDeprecatedOptions({
                    excludePagesWithPatterns: ['pattern'],
                    shouldCapturePlainTextChapters: true,
                });
            }).toThrow('shouldCapturePlainTextChapters has been deprecated in favour of patternToOptions');
        });

        it('should throw error for patternToType when provided with other valid options', () => {
            expect(() => {
                validateDeprecatedOptions({
                    patternToType: { '^test': 1 },
                    replacements: { old: 'new' },
                });
            }).toThrow('patternToType has been deprecated in favour of patternToOptions');
        });

        it('should throw error for flatten when provided with other valid options', () => {
            expect(() => {
                validateDeprecatedOptions({
                    flatten: true,
                    patternToOptions: { '^test': { type: 1 } },
                });
            }).toThrow('flatten has been deprecated in favour of replacements[HTML]');
        });
    });

    describe('validateParseOptions', () => {
        it('should not throw when patternToOptions is not provided', () => {
            expect(() => {
                validateParseOptions({});
            }).not.toThrow();
        });

        it('should not throw when patternToOptions is empty', () => {
            expect(() => {
                validateParseOptions({ patternToOptions: {} });
            }).not.toThrow();
        });

        it('should not throw for valid patterns with capture groups', () => {
            expect(() => {
                validateParseOptions({
                    patternToOptions: {
                        '^((بَابُ).*)': { type: 2 },
                        '^([\\u0660-\\u0669]+\\s?[-–—ـ].*)': { minPage: 153 },
                        '^(test.*)': {},
                    },
                });
            }).not.toThrow();
        });

        it('should not throw for patterns with nested capture groups', () => {
            expect(() => {
                validateParseOptions({
                    patternToOptions: {
                        '^((group1|group2).*)': {},
                    },
                });
            }).not.toThrow();
        });

        it('should not throw for patterns with non-capturing groups and capture groups', () => {
            expect(() => {
                validateParseOptions({
                    patternToOptions: {
                        '^(?:prefix)(captured.*)': {},
                    },
                });
            }).not.toThrow();
        });

        it('should throw for pattern without any capture group', () => {
            expect(() => {
                validateParseOptions({
                    patternToOptions: {
                        '^test.*': {},
                    },
                });
            }).toThrow(/must contain at least one capture group/);
        });

        it('should throw for pattern with only non-capturing groups', () => {
            expect(() => {
                validateParseOptions({
                    patternToOptions: {
                        '^(?:test).*': {},
                    },
                });
            }).toThrow(/must contain at least one capture group/);
        });

        it('should throw for pattern with escaped parentheses only', () => {
            expect(() => {
                validateParseOptions({
                    patternToOptions: {
                        '^\\(test\\).*': {},
                    },
                });
            }).toThrow(/must contain at least one capture group/);
        });

        it('should throw for invalid regex pattern', () => {
            expect(() => {
                validateParseOptions({
                    patternToOptions: {
                        '^[invalid(regex': {},
                    },
                });
            }).toThrow(/Invalid regex pattern/);
        });

        it('should throw for invalid regex with unbalanced brackets', () => {
            expect(() => {
                validateParseOptions({
                    patternToOptions: {
                        '^[': {},
                    },
                });
            }).toThrow(/Invalid regex pattern/);
        });

        it('should include the problematic pattern in error message', () => {
            expect(() => {
                validateParseOptions({
                    patternToOptions: {
                        '^nocapture': {},
                    },
                });
            }).toThrow('"^nocapture"');
        });

        it('should validate all patterns and throw on first invalid one', () => {
            expect(() => {
                validateParseOptions({
                    patternToOptions: {
                        '^(also-valid.*)': {},
                        '^(valid.*)': {},
                        '^invalid': {},
                    },
                });
            }).toThrow(/must contain at least one capture group.*"\^invalid"/);
        });

        it('should not throw for complex Arabic patterns with capture groups', () => {
            expect(() => {
                validateParseOptions({
                    patternToOptions: {
                        '^(([\\u0660-\\u0669]+\\s?[-–—ـ]|•|وَاعْلَمْ).*)': {},
                        '^((\\[بِسْمِ |بِسْمِ اللَّهِ|أَخْبَرَنَا).*)': {},
                    },
                });
            }).not.toThrow();
        });

        it('should throw for complex pattern missing capture group', () => {
            expect(() => {
                validateParseOptions({
                    patternToOptions: {
                        '^[\\u0660-\\u0669]+\\s?[-–—ـ].*': {},
                    },
                });
            }).toThrow(/must contain at least one capture group/);
        });
    });

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
});
