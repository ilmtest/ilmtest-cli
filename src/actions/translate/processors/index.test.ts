import { describe, expect, it } from 'bun:test';

import type { Page } from '../../api/maktabah';

import { indexPages } from '.';
import { PATTERNS } from '../translate/patterns';
import { createKitabProcessor, createNumberedParagraphProcessor, createSimpleBabProcessor } from './handlers';
import { makeDiacriticInsensitive } from './utils';

describe('discrete', () => {
    describe('indexDiscretePages', () => {
        it('should index the book and narration', async () => {
            let pages = (await Bun.file('tmp/303/pages.json').json()) as Page[];
            pages = pages.filter((p) => p.page >= 4143 && p.page <= 4144);
            pages = pages.slice();

            const result = indexPages(pages, [
                createKitabProcessor(PATTERNS.KitabPrefix),
                createSimpleBabProcessor(
                    new RegExp(`^(${makeDiacriticInsensitive('باب')}|${makeDiacriticInsensitive('جماع')}).*$`, 'm'),
                ),
                createNumberedParagraphProcessor(PATTERNS.MatchNumberedParagraph),
            ]);

            console.log('result', result);
        });
    });
});
