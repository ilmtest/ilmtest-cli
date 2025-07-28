export const PATTERNS = {
    BookTitles: /^\d+ – The Book/,
    ChapterTitles: /^Chapter: /,
    MatchBabTitlesUpToNumberedListItem: /^(بَ[َُِّ]*ابُ[َُِّ]*.*?)(?:(\d+\s*-.*))?$/s,
    MatchNumberedParagraph: /^(\d+)\s?[-–] (.*)$/gm,
    MatchNumericListItem: /^(\d+)\s?[-–—ـ](.*)/,
    NumberedKitabTitles: /^\d+ - كتاب/,
};
