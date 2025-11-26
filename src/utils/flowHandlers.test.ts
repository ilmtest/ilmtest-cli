import { describe, expect, it } from 'bun:test';
import { processTranslation } from './flowHandlers';

describe('flowHandlers', () => {
    describe('processTranslation', () => {
        it('should pick up the translation marker', () => {
            const translations = [];

            ['B1 - Book', 'C3c - Chapter', 'F2 - Footnote', 'T1b - Heading', 'P122a - Hi'].forEach((line) => {
                processTranslation(line, translations);
            });

            expect(translations).toMatchObject([
                {
                    id: 'B1',
                    text: 'Book',
                },
                {
                    id: 'C3c',
                    text: 'Chapter',
                },
                {
                    id: 'F2',
                    text: 'Footnote',
                },
                {
                    id: 'T1b',
                    text: 'Heading',
                },
                {
                    id: 'P122a',
                    text: 'Hi',
                },
            ]);
        });

        it('should not handle non-markers', () => {
            const translations = [];

            processTranslation('A line', translations);

            expect(translations).toBeEmpty();
        });
    });
});
