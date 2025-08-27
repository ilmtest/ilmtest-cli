import type { Page } from '../../api/maktabah.js';

import { buildDiacriticsInsensitiveExactRegex } from './processors/utils.js';

export const injectIndexByPrefix = (pages: Page[], prefix: string) => {
    const result: Page[] = [];
    const regex = buildDiacriticsInsensitiveExactRegex([prefix]);
    let currentIndex = 0;

    for (const page of pages) {
        const lines = page.body.split('\n').map((line) => {
            if (line.match(regex)) {
                line = `${++currentIndex} - ${line}`;
            }

            return line.trim();
        });

        result.push({ ...page, body: lines.join('\n') });
    }

    return result;
};

export const injectIndexByPage = (pages: Page[]) => {
    return pages.map((page) => {
        return { ...page, body: `${page.page} - ${page.body}`.trim() };
    });
};
