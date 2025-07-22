export const getArabicScore = (text: string) => {
    if (!text || text.length === 0) return 0;

    const arabicPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g;
    const nonWhitespacePattern = /[^\s\d]/g;

    const arabicMatches = text.match(arabicPattern) || [];
    const totalMatches = text.match(nonWhitespacePattern) || [];

    return totalMatches.length === 0 ? 0 : arabicMatches.length / totalMatches.length;
};

export const convertArabicIndicToRoman = (text: string) => {
    // Create formatters
    const romanFormatter = new Intl.NumberFormat('en', { numberingSystem: 'roman' });

    // Process each line
    return text
        .split('\n')
        .map((line) => {
            // Find Arabic-Indic digit sequences at the beginning of the line
            return line.replace(/^([٠-٩]+)/, (match) => {
                // Convert Arabic-Indic digits to regular digits using Unicode arithmetic
                const num = parseInt(
                    match.replace(/[٠-٩]/g, (digit) => {
                        return String.fromCharCode(digit.charCodeAt(0) - '٠'.charCodeAt(0) + '0'.charCodeAt(0));
                    }),
                    10,
                );

                // Use Intl to format as Roman numerals
                return romanFormatter.format(num).toUpperCase();
            });
        })
        .join('\n');
};

export const toTitleCase = (str: string) => {
    return str
        .toLowerCase()
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

/**
 * Parses page input string into array of page numbers, supporting ranges and lists
 * @param pageInput - Page specification string (e.g., "1-5" or "1,3,5")
 * @returns Array of page numbers
 * @throws Error when start page exceeds end page in range
 */
export const parsePageRanges = (pageInput: string): number[] => {
    if (pageInput.includes('-')) {
        const [start, end] = pageInput.split('-').map(Number);

        if (start > end) {
            throw new Error('Start page cannot be greater than end page');
        }

        return Array.from({ length: end - start + 1 }, (_, i) => start + i);
    } else {
        return pageInput.split(',').map(Number);
    }
};
