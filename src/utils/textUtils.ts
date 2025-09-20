export const PATTERNS = {
    EndsWithNumber: /[\u0660-\u0669]$/,
    EndsWithPunctuation: /[.!?؟؛…]$/,
    MatchArabicNumericListItem: /^([\u0660-\u0669]+)\s?[-–—ـ](.*)/,
    MatchNumberedParagraph: /^(\d+)\s+[-–—ـ]\s+(.*)$/gm,
    MatchNumericListItem: /^(\d+)\s?[-–—ـ](.*)/,
    MatchRoundArabicNumericItem: /^\(([\u0660-\u0669]+)\)$/,
};

export const findLastPunctuation = (text: string) => {
    for (let i = text.length - 1; i >= 0; i--) {
        if (PATTERNS.EndsWithPunctuation.test(text[i])) {
            return i;
        }
    }

    return -1;
};
