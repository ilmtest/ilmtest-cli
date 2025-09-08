import { describe, expect, it } from 'bun:test';

import { parseContentRobust } from './shamelaUtils';

describe('shamelaUtils', () => {
    describe('parseContentRobust', () => {
        it('should handle nested tags', () => {
            const actual = parseContentRobust(
                `من الثامنة ت\r\r<span data-type="title" id=toc-66><span data-type="title" id=toc-67>ذكر من اسمه فضيل بالتصغير إلى آخر حرف الفاء</span></span>\r٥٤٢٦- فضيل ابن حسين`,
            );

            expect(actual).toEqual([
                {
                    text: 'من الثامنة ت',
                },
                {
                    id: '66',
                    text: 'ذكر من اسمه فضيل بالتصغير إلى آخر حرف الفاء',
                },
                {
                    text: '٥٤٢٦- فضيل ابن حسين',
                },
            ]);
        });

        it('should combine nested tags into one', () => {
            const actual = parseContentRobust(
                `<span data-type="title" id=toc-137><span data-type="title" id=toc-139>ب</span><span data-type="title" id=toc-138>ا</span>ب الأنساب إلى القبائل والبلاد والصنائع وغير ذلك</span>\r[أ]`,
            );

            expect(actual).toEqual([
                {
                    id: '137',
                    text: 'باب الأنساب إلى القبائل والبلاد والصنائع وغير ذلك',
                },
                {
                    text: '[أ]',
                },
            ]);
        });
    });
});
