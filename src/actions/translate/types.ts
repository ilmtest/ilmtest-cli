import type { Page } from '../../api/maktabah.js';

export type PageRange = Page & {
    end?: number;
};
