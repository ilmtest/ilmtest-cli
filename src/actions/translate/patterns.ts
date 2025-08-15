const KITAB_ARABIC = 'كتاب';

export const PATTERNS = {
    BookTitles: /^(\d+ [–\-—] (?:The Book|Book of))/,
    ChapterTitles: /^Chapter: |^Collection of |^Issue |^What /,
    KitabPrefix: new RegExp([`^${KITAB_ARABIC} `, `^\\d+ ${KITAB_ARABIC}`].join('|')),
    MatchBabTitlesUpToNumberedListItem: /^(بَ[َُِّ]*ابُ[َُِّ]*.*?)(?:(\d+\s*-.*))?$/s,
    MatchNumberedParagraph: /^(\d+)\s?[-–] (.*)$/gm,
    MatchNumericListItem: /^(\d+)\s?[-–—ـ](.*)/,
    NumberedKitabTitles: /^\d+ - كتاب/,
};
