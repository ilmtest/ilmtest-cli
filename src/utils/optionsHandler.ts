import { parsePageRanges } from 'bitaboom';
import type { MatnParseOptions, ShamelaPage } from '@/types.js';

export const filterExcludedPages = (pages: ShamelaPage[], options: MatnParseOptions) => {
    if (options.excludePagesWithPatterns) {
        const pattern = new RegExp(options.excludePagesWithPatterns.join('|'), 'um');

        pages = pages.filter((p) => {
            return !pattern.test(p.content);
        });
    }

    if (options.excludePages) {
        const excludedPages = new Set(
            options.excludePages.flatMap((r) => {
                const range = parsePageRanges(r);
                return range;
            }),
        );

        pages = pages.filter((p) => !excludedPages.has(p.id));
    }

    return pages;
};

export const applyCustomPatches = (pages: ShamelaPage[], options: MatnParseOptions) => {
    if (options.aslPatches) {
        const pageIdToPatches = Object.groupBy(options.aslPatches, (patch) => patch.page);

        pages = pages.map((p) => {
            const patches = pageIdToPatches[p.id];

            if (patches) {
                let content = p.content;

                for (const patch of patches) {
                    const regex = new RegExp(patch.match, 'um');
                    content = content.replace(regex, patch.replacement);
                }

                return { ...p, content };
            }

            return p;
        });
    }

    return pages;
};
