import { describe, expect, it } from 'bun:test';

import { convertArabicIndicToRoman } from './textUtils';

describe('textUtils', () => {
    describe('convertArabicIndicToRoman', () => {
        it('should convert the text', () => {
            const arabicText = [`٢ - A`, `٣ - B`, `١٢ - C`, `٢٥ - D`];

            const actual = convertArabicIndicToRoman(arabicText.join('\n')).split('\n');

            expect(actual).toEqual(['2 - A', '3 - B', '12 - C', '25 - D']);
        });
    });
});
