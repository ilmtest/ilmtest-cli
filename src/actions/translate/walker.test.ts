import { describe, expect, it } from 'bun:test';

import type { Page } from '../../api/maktabah';

import { walkAndIndexLines, walkAndIndexPages } from './walker';

describe('walker', () => {
    describe('walkAndIndexLines', () => {
        it('should index the lines appropriately', () => {
            const actual = walkAndIndexLines([
                '1-Text1',
                '2- Text2',
                '3 - Text3',
                'Something',
                '4 else',
                '6-Another',
                'line',
            ]);

            expect(actual).toEqual({
                '1': 'Text1',
                '2': 'Text2',
                '3': 'Text3\nSomething\n4 else',
                '6': 'Another\nline',
            });
        });
    });

    describe('walkAndIndexPages', () => {
        it('should index the pages appropriately', () => {
            const actual = walkAndIndexPages([
                {
                    body: ['1-Text1', '2- Text2', '3 - Text3', 'Something', '4 else', '6-Another'].join('\n'),
                    page: 1,
                },
                {
                    body: ['line'].join('\n'),
                    page: 2,
                },
            ] as Page[]) as Record<string, any>;

            expect(actual).toEqual({
                '1': {
                    body: 'Text1',
                    page: 1,
                },
                '2': {
                    body: 'Text2',
                    page: 1,
                },
                '3': {
                    body: 'Text3\nSomething\n4 else',
                    page: 1,
                },
                '6': {
                    body: 'Another\nline',
                    end: 2,
                    page: 1,
                },
            });
        });
    });
});
