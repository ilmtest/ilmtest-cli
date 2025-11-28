import type { MatnParseOptions } from '@/types.js';
import { MARKER_ID_PATTERN, TRANSLATION_MARKER_PARTS } from './constants.js';

/**
 * Validates that patternToOptions contains valid regex patterns with capture groups.
 * Throws an error if a pattern is invalid or missing capture groups.
 */
export const validateParseOptions = ({ patternToOptions = {} }: MatnParseOptions) => {
    for (const pattern of Object.keys(patternToOptions)) {
        // Validate that the pattern is a valid regex
        try {
            new RegExp(pattern, 'u');
        } catch (e) {
            throw new Error(`Invalid regex pattern in patternToOptions: "${pattern}" - ${(e as Error).message}`);
        }

        // Check that the pattern contains at least one capture group
        // We need to account for escaped parentheses \( \) and non-capturing groups (?:
        const unescapedPattern = pattern
            .replace(/\\./g, '') // Remove all escaped characters
            .replace(/\(\?:/g, ''); // Remove non-capturing group markers

        // Count remaining unescaped opening parentheses that start capture groups
        const captureGroupCount = (unescapedPattern.match(/\(/g) || []).length;

        if (captureGroupCount === 0) {
            throw new Error(
                `Pattern in patternToOptions must contain at least one capture group: "${pattern}". ` +
                    `Without a capture group, the matched text cannot be extracted. ` +
                    `Wrap the part you want to capture in parentheses, e.g., "^(${pattern.replace(/^\^/, '')})"`,
            );
        }
    }
};

export const validateDeprecatedOptions = ({
    numeralStrategy,
    firstPageWithIndex,
    newEntryMarkerPattern,
    captureCommaSeparatedIndices,
    sanitize,
    fix,
    removePagesWithPattern,
    hasDuplicateNumerals,
    patternToType,
    flatten,
    pageSpanning,
    shouldCapturePlainTextChapters,
}: MatnParseOptions) => {
    if (numeralStrategy) {
        throw new Error(`numeralStrategy has been deprecated, please migrate the breaking changes`);
    }

    if (pageSpanning) {
        throw new Error('pageSpanning has been replaced with overflow');
    }

    if (removePagesWithPattern) {
        throw new Error('removePagesWithPattern has been replaced with excludePagesWithPatterns');
    }

    if (fix) {
        throw new Error('fix has been deprecated');
    }

    if (firstPageWithIndex) {
        throw new Error(`firstPageWithIndex has been moved to the minPage in the patternToOptions`);
    }

    if (hasDuplicateNumerals) {
        throw new Error('hasDuplicateNumerals has been deprecated');
    }

    if (newEntryMarkerPattern) {
        throw new Error('newEntryMarkerPattern has been replaced with patternToOptions');
    }

    if (captureCommaSeparatedIndices) {
        throw new Error('captureCommaSeparatedIndices has been deprecated in favour of patternToOptions');
    }

    if (sanitize) {
        throw new Error('sanitize has been deprecated in favour of replacements');
    }

    if (shouldCapturePlainTextChapters) {
        throw new Error('shouldCapturePlainTextChapters has been deprecated in favour of patternToOptions');
    }

    if (patternToType) {
        throw new Error('patternToType has been deprecated in favour of patternToOptions');
    }

    if (flatten) {
        throw new Error('flatten has been deprecated in favour of replacements[HTML]');
    }
};

export const validateTranslationMarkers = (text: string) => {
    const { markers, digits, suffix, dashes, optionalSpace } = TRANSLATION_MARKER_PARTS;

    // Check for invalid reference format (with dash but wrong structure)
    // This catches cases like B12a34 -, P1x2y3 -, P2247$2 -, etc.
    const invalidRefPattern = new RegExp(
        `^${markers}(?=.*${dashes})(?!${digits}${suffix}*${optionalSpace}${dashes})[^\\s-–—]+${optionalSpace}${dashes}`,
        'm',
    );
    const invalidRef = text.match(invalidRefPattern);

    if (invalidRef) {
        return `Error in text: invalid reference format "${invalidRef[0].trim()}" - expected format is letter + numbers + optional suffix (a-j) + dash`;
    }

    // Check for space before reference with multi-letter suffix (e.g., " P123ab -")
    const spaceBeforePattern = new RegExp(` ${markers}${digits}${suffix}+${optionalSpace}${dashes}`, 'm');

    // Check for reference with single letter suffix but no dash after (e.g., "P123a without")
    const suffixNoDashPattern = new RegExp(`^${markers}${digits}${suffix}(?! ${dashes})`, 'm');

    const match = text.match(spaceBeforePattern) || text.match(suffixNoDashPattern);

    if (match) {
        return `Error in text: found "${match[0]}"`;
    }

    // Check for references with dash but no content after (e.g., "P123 -")
    const emptyAfterDashPattern = new RegExp(`^${MARKER_ID_PATTERN}${optionalSpace}${dashes}\\s*$`, 'm');
    const emptyAfterDash = text.match(emptyAfterDashPattern);

    if (emptyAfterDash) {
        return `Error in text: reference "${emptyAfterDash[0].trim()}" has dash but no content after it`;
    }

    // Check for $ character in references (invalid format like B1234$5)
    const dollarSignPattern = new RegExp(`^${markers}${digits}\\$${digits}`, 'm');
    const dollarSignRef = text.match(dollarSignPattern);

    if (dollarSignRef) {
        return `Error in text: invalid reference format "${dollarSignRef[0]}" - contains $ character`;
    }
};
