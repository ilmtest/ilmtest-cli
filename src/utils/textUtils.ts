export const getArabicScore = (text: string) => {
    if (!text || text.length === 0) return 0;

    const arabicPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g;
    const nonWhitespacePattern = /[^\s\d]/g;

    const arabicMatches = text.match(arabicPattern) || [];
    const totalMatches = text.match(nonWhitespacePattern) || [];

    return totalMatches.length === 0 ? 0 : arabicMatches.length / totalMatches.length;
};
