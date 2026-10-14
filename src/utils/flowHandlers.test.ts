import { describe, expect, it } from 'bun:test';
import type { Line } from 'shamela';
import { EntryType } from '../api/entries.js';
import type { Translation } from '../types.js';
import { EntriesContext } from './entryContext.js';
import {
    appendLineToLastEntry,
    appendNewPageToLastEntry,
    appendToLastTranslation,
    captureEntirePage,
    captureFirstLooseLeaf,
    captureMarkdownChapters,
    captureNewEntryByPatternOptions,
    captureNumericChapters,
    flattenNumericChapters,
    processChapter,
    processTranslation,
    removeSquareBracketsFromTitles,
    trimLine,
} from './flowHandlers';

describe('flowHandlers', () => {
    describe('trimLine', () => {
        it('should trim whitespace from beginning and end of line text', () => {
            const line: Line = { text: '  test text  ' };
            trimLine(line);
            expect(line.text).toBe('test text');
        });

        it('should handle line with only whitespace', () => {
            const line: Line = { text: '   ' };
            trimLine(line);
            expect(line.text).toBe('');
        });

        it('should handle line with no whitespace', () => {
            const line: Line = { text: 'test' };
            trimLine(line);
            expect(line.text).toBe('test');
        });

        it('should handle empty string', () => {
            const line: Line = { text: '' };
            trimLine(line);
            expect(line.text).toBe('');
        });
    });

    describe('flattenNumericChapters', () => {
        it('should remove ID from line matching Arabic numeric list item pattern', () => {
            const line: Line = { id: 'test-id', text: '١- نص عربي' };
            flattenNumericChapters(line);
            expect(line.id).toBeUndefined();
        });

        it('should not remove ID when line does not match pattern', () => {
            const line: Line = { id: 'test-id', text: 'نص عادي' };
            flattenNumericChapters(line);
            expect(line.id).toBe('test-id');
        });

        it('should not remove ID when line has no ID', () => {
            const line: Line = { text: '١- نص عربي' };
            flattenNumericChapters(line);
            expect(line.id).toBeUndefined();
        });

        it('should handle line with en dash', () => {
            const line: Line = { id: 'test-id', text: '٢– نص عربي' };
            flattenNumericChapters(line);
            expect(line.id).toBeUndefined();
        });
    });

    describe('captureNumericChapters', () => {
        it('should capture numeric chapter and add entry when line has ID and matches pattern', () => {
            const line: Line = { id: 'chapter-1', text: '١- كتاب الفقه' };
            const page: any = { id: 10 };
            const context = new EntriesContext('\n');

            const result = captureNumericChapters(line, page, context);

            expect(result).toBe(true);
            expect(context.result).toHaveLength(1);
            expect(context.result[0]).toMatchObject({
                arabic: 'كتاب الفقه',
                from: 10,
                id: 'chapter-1',
                index: 1,
                type: EntryType.Book,
            });
        });

        it('should capture chapter entry when text starts with كتاب', () => {
            const line: Line = { id: 'chapter-2', text: '٢- كتاب الصلاة' };
            const page: any = { id: 20 };
            const context = new EntriesContext('\n');

            captureNumericChapters(line, page, context);

            expect(context.result[0].type).toBe(EntryType.Book);
        });

        it('should capture regular chapter entry when text does not start with كتاب', () => {
            const line: Line = { id: 'chapter-3', text: '٣- باب الوضوء' };
            const page: any = { id: 30 };
            const context = new EntriesContext('\n');

            captureNumericChapters(line, page, context);

            expect(context.result[0].type).toBe(EntryType.Chapter);
        });

        it('should return undefined when line has no ID', () => {
            const line: Line = { text: '١- نص عربي' };
            const page: any = { id: 10 };
            const context = new EntriesContext('\n');

            const result = captureNumericChapters(line, page, context);

            expect(result).toBeUndefined();
            expect(context.result).toHaveLength(0);
        });

        it('should return undefined when line does not match pattern', () => {
            const line: Line = { id: 'test-id', text: 'نص عادي' };
            const page: any = { id: 10 };
            const context = new EntriesContext('\n');

            const result = captureNumericChapters(line, page, context);

            expect(result).toBeUndefined();
            expect(context.result).toHaveLength(0);
        });

        it('should trim arabic text', () => {
            const line: Line = { id: 'chapter-4', text: '٤-   نص مع مسافات   ' };
            const page: any = { id: 40 };
            const context = new EntriesContext('\n');

            captureNumericChapters(line, page, context);

            expect(context.result[0].arabic).toBe('نص مع مسافات');
        });
    });

    describe('captureMarkdownChapters', () => {
        it('should add ID to line starting with # when line has no ID', () => {
            const line: Line = { text: '# Chapter Title' };
            captureMarkdownChapters(line);
            expect(line.id).toBe('0');
            expect(line.text).toBe(' Chapter Title');
        });

        it('should not modify line that already has ID', () => {
            const line: Line = { id: 'existing-id', text: '# Chapter Title' };
            captureMarkdownChapters(line);
            expect(line.id).toBe('existing-id');
            expect(line.text).toBe('# Chapter Title');
        });

        it('should not modify line that does not start with #', () => {
            const line: Line = { text: 'Regular text' };
            captureMarkdownChapters(line);
            expect(line.id).toBeUndefined();
            expect(line.text).toBe('Regular text');
        });

        it('should handle line with only #', () => {
            const line: Line = { text: '#' };
            captureMarkdownChapters(line);
            expect(line.id).toBe('0');
            expect(line.text).toBe('');
        });
    });

    describe('removeSquareBracketsFromTitles', () => {
        it('should remove square brackets from title when line has ID and matches pattern', () => {
            const line: Line = { id: 'test-id', text: '[Title - Subtitle]' };
            removeSquareBracketsFromTitles(line);
            expect(line.text).toBe('Title - Subtitle');
        });

        it('should not modify line without ID', () => {
            const line: Line = { text: '[Title - Subtitle]' };
            removeSquareBracketsFromTitles(line);
            expect(line.text).toBe('[Title - Subtitle]');
        });

        it('should not modify line that does not match pattern', () => {
            const line: Line = { id: 'test-id', text: 'Regular text' };
            removeSquareBracketsFromTitles(line);
            expect(line.text).toBe('Regular text');
        });

        it('should handle pattern with spaces around dash', () => {
            const line: Line = { id: 'test-id', text: '[Title  -  Subtitle]' };
            removeSquareBracketsFromTitles(line);
            expect(line.text).toBe('Title  -  Subtitle');
        });
    });

    describe('processChapter', () => {
        it('should create chapter entry when line has ID', () => {
            const line: Line = { id: 'chapter-1', text: 'كتاب الصلاة' };
            const page: any = { id: 10 };
            const context = new EntriesContext('\n');

            const result = processChapter(line, page, context);

            expect(result).toBe(true);
            expect(context.result).toHaveLength(1);
            expect(context.result[0]).toMatchObject({
                arabic: 'كتاب الصلاة',
                from: 10,
                id: 'chapter-1',
                type: EntryType.Book,
            });
        });

        it('should create book entry when text starts with كتاب', () => {
            const line: Line = { id: 'book-1', text: 'كتاب الفقه' };
            const page: any = { id: 20 };
            const context = new EntriesContext('\n');

            processChapter(line, page, context);

            expect(context.result[0].type).toBe(EntryType.Book);
        });

        it('should create chapter entry when text does not start with كتاب', () => {
            const line: Line = { id: 'chapter-1', text: 'باب الوضوء' };
            const page: any = { id: 30 };
            const context = new EntriesContext('\n');

            processChapter(line, page, context);

            expect(context.result[0].type).toBe(EntryType.Chapter);
        });

        it('should return undefined when line has no ID', () => {
            const line: Line = { text: 'نص عادي' };
            const page: any = { id: 10 };
            const context = new EntriesContext('\n');

            const result = processChapter(line, page, context);

            expect(result).toBeUndefined();
            expect(context.result).toHaveLength(0);
        });

        it('should trim text before checking for كتاب', () => {
            const line: Line = { id: 'book-1', text: '  كتاب الصلاة  ' };
            const page: any = { id: 40 };
            const context = new EntriesContext('\n');

            processChapter(line, page, context);

            expect(context.result[0].type).toBe(EntryType.Book);
        });
    });

    describe('captureNewEntryByPatternOptions', () => {
        it('should capture new entry when pattern matches and minPage is not set', () => {
            const handler = captureNewEntryByPatternOptions(/^Pattern (.+)$/, { type: EntryType.Chapter });
            const line: Line = { text: 'Pattern Some Text' };
            const page: any = { id: 10 };
            const context = new EntriesContext('\n');

            const result = handler(line, page, context);

            expect(result).toBe(true);
            expect(context.result).toHaveLength(1);
            expect(context.result[0]).toMatchObject({
                arabic: 'Some Text',
                from: 10,
                type: EntryType.Chapter,
            });
        });

        it('should capture new entry when pattern matches and page id is greater than or equal to minPage', () => {
            const handler = captureNewEntryByPatternOptions(/^Entry (.+)$/, {
                minPage: 5,
                type: EntryType.Book,
            });
            const line: Line = { text: 'Entry Book Title' };
            const page: any = { id: 10 };
            const context = new EntriesContext('\n');

            const result = handler(line, page, context);

            expect(result).toBe(true);
            expect(context.result[0].type).toBe(EntryType.Book);
        });

        it('should capture new entry when pattern matches and page id equals minPage', () => {
            const handler = captureNewEntryByPatternOptions(/^Test (.+)$/, {
                minPage: 5,
                type: EntryType.Chapter,
            });
            const line: Line = { text: 'Test Chapter Title' };
            const page: any = { id: 5 };
            const context = new EntriesContext('\n');

            const result = handler(line, page, context);

            expect(result).toBe(true);
            expect(context.result).toHaveLength(1);
        });

        it('should not capture entry when pattern matches but page id is less than minPage', () => {
            const handler = captureNewEntryByPatternOptions(/^Pattern (.+)$/, {
                minPage: 10,
                type: EntryType.Chapter,
            });
            const line: Line = { text: 'Pattern Some Text' };
            const page: any = { id: 5 };
            const context = new EntriesContext('\n');

            const result = handler(line, page, context);

            expect(result).toBeUndefined();
            expect(context.result).toHaveLength(0);
        });

        it('should not capture entry when pattern does not match', () => {
            const handler = captureNewEntryByPatternOptions(/^Pattern (.+)$/, { type: EntryType.Chapter });
            const line: Line = { text: 'No Match Here' };
            const page: any = { id: 10 };
            const context = new EntriesContext('\n');

            const result = handler(line, page, context);

            expect(result).toBeUndefined();
            expect(context.result).toHaveLength(0);
        });

        it('should trim captured text', () => {
            const handler = captureNewEntryByPatternOptions(/^Pattern (.+)$/, { type: EntryType.Chapter });
            const line: Line = { text: 'Pattern   Trimmed Text  ' };
            const page: any = { id: 10 };
            const context = new EntriesContext('\n');

            handler(line, page, context);

            expect(context.result[0].arabic).toBe('Trimmed Text');
        });
    });

    describe('captureEntirePage', () => {
        it('should capture entire page when no last entry exists', () => {
            const line: Line = { text: 'Page content' };
            const page: any = { id: 10 };
            const context = new EntriesContext('\n');

            const result = captureEntirePage(line, page, context);

            expect(result).toBe(true);
            expect(context.result).toHaveLength(1);
            expect(context.result[0]).toMatchObject({
                arabic: 'Page content',
                from: 10,
            });
        });

        it('should capture entire page when gap between pages is greater than 1', () => {
            const line: Line = { text: 'New page content' };
            const page: any = { id: 15 };
            const context = new EntriesContext('\n');
            context.addEntry({ arabic: 'Previous content', from: 10 });

            const result = captureEntirePage(line, page, context);

            expect(result).toBe(true);
            expect(context.result).toHaveLength(2);
            expect(context.result[1]).toMatchObject({
                arabic: 'New page content',
                from: 15,
            });
        });

        it('should not capture when gap between pages is 0', () => {
            const line: Line = { text: 'Next page content' };
            const page: any = { id: 10 };
            const context = new EntriesContext('\n');
            context.addEntry({ arabic: 'Previous content', from: 10 });

            const result = captureEntirePage(line, page, context);

            expect(result).toBeUndefined();
            expect(context.result).toHaveLength(1);
        });

        it('should not capture when gap between pages is 0', () => {
            const line: Line = { text: 'Same page content' };
            const page: any = { id: 10 };
            const context = new EntriesContext('\n');
            context.addEntry({ arabic: 'Previous content', from: 10 });

            const result = captureEntirePage(line, page, context);

            expect(result).toBeUndefined();
            expect(context.result).toHaveLength(1);
        });
    });

    describe('captureFirstLooseLeaf', () => {
        it('should capture first loose leaf when no last entry exists', () => {
            const line: Line = { text: 'First page content' };
            const page: any = { id: 1 };
            const context = new EntriesContext('\n');

            const result = captureFirstLooseLeaf(line, page, context);

            expect(result).toBe(true);
            expect(context.result).toHaveLength(1);
            expect(context.result[0]).toMatchObject({
                arabic: 'First page content',
                from: 1,
            });
        });

        it('should not capture when last entry exists', () => {
            const line: Line = { text: 'Second page content' };
            const page: any = { id: 2 };
            const context = new EntriesContext('\n');
            context.addEntry({ arabic: 'First content', from: 1 });

            const result = captureFirstLooseLeaf(line, page, context);

            expect(result).toBeUndefined();
            expect(context.result).toHaveLength(1);
        });
    });

    describe('appendLineToLastEntry', () => {
        it('should append line text to last entry', () => {
            const line: Line = { text: 'Additional text' };
            const page: any = { id: 10 };
            const context = new EntriesContext('\n');
            context.addEntry({ arabic: 'Initial text', from: 5 });

            const result = appendLineToLastEntry(line, page, context);

            expect(result).toBe(true);
            expect(context.result[0].arabic).toBe('Initial text\nAdditional text');
        });

        it('should update to field when page id differs from entry from', () => {
            const line: Line = { text: 'New page text' };
            const page: any = { id: 15 };
            const context = new EntriesContext('\n');
            context.addEntry({ arabic: 'Initial text', from: 10 });

            appendLineToLastEntry(line, page, context);

            expect(context.result[0].to).toBe(15);
        });

        it('should not update to field when page id equals entry from', () => {
            const line: Line = { text: 'Same page text' };
            const page: any = { id: 10 };
            const context = new EntriesContext('\n');
            context.addEntry({ arabic: 'Initial text', from: 10 });

            appendLineToLastEntry(line, page, context);

            expect(context.result[0].to).toBeUndefined();
        });

        it('should use custom separator when provided', () => {
            const line: Line = { text: 'Additional text' };
            const page: any = { id: 10 };
            const context = new EntriesContext('\n');
            context.addEntry({ arabic: 'Initial text', from: 5 });

            appendLineToLastEntry(line, page, context, ' ');

            expect(context.result[0].arabic).toBe('Initial text Additional text');
        });

        it('should filter out empty strings when joining', () => {
            const line: Line = { text: '' };
            const page: any = { id: 10 };
            const context = new EntriesContext('\n');
            context.addEntry({ arabic: 'Initial text', from: 5 });

            appendLineToLastEntry(line, page, context);

            expect(context.result[0].arabic).toBe('Initial text');
        });
    });

    describe('appendNewPageToLastEntry', () => {
        it('should capture entire page when last entry ends with punctuation', () => {
            const line: Line = { text: 'New page content.' };
            const page: any = { id: 15 };
            const context = new EntriesContext('\n');
            context.addEntry({ arabic: 'Previous content.', from: 10 });

            const result = appendNewPageToLastEntry(line, page, context);

            expect(result).toBe(true);
            expect(context.result).toHaveLength(2);
            expect(context.result[1]).toMatchObject({
                arabic: 'New page content.',
                from: 15,
            });
        });

        it('should capture entire page when last entry ends with number', () => {
            const line: Line = { text: 'New page content' };
            const page: any = { id: 15 };
            const context = new EntriesContext('\n');
            context.addEntry({ arabic: 'Previous content ١٢٣', from: 10 });

            const result = appendNewPageToLastEntry(line, page, context);

            expect(result).toBe(true);
            expect(context.result).toHaveLength(2);
        });

        it('should split content at last punctuation and append before punctuation to last entry', () => {
            const line: Line = { text: 'First part. Second part' };
            const page: any = { id: 15 };
            const context = new EntriesContext('\n');
            context.addEntry({ arabic: 'Previous content', from: 10 });

            const result = appendNewPageToLastEntry(line, page, context);

            expect(result).toBe(true);
            expect(context.result[0].arabic).toBe('Previous content\nFirst part.');
            expect(context.result[0].to).toBe(15);
            expect(context.result[1]).toMatchObject({
                arabic: 'Second part',
                from: 15,
            });
        });

        it('should handle line with no punctuation by using end of line', () => {
            const line: Line = { text: 'No punctuation here' };
            const page: any = { id: 15 };
            const context = new EntriesContext('\n');
            context.addEntry({ arabic: 'Previous content', from: 10 });

            const result = appendNewPageToLastEntry(line, page, context);

            expect(result).toBe(true);
            expect(context.result[0].arabic).toBe('Previous content\nNo punctuation here');
            expect(context.result[0].to).toBe(15);
        });

        it('should not create new entry when after punctuation is empty', () => {
            const line: Line = { text: 'Only first part.' };
            const page: any = { id: 15 };
            const context = new EntriesContext('\n');
            context.addEntry({ arabic: 'Previous content', from: 10 });

            const result = appendNewPageToLastEntry(line, page, context);

            expect(result).toBe(true);
            expect(context.result).toHaveLength(1);
            expect(context.result[0].arabic).toBe('Previous content\nOnly first part.');
        });

        it('should trim after punctuation text', () => {
            const line: Line = { text: 'First part.   Second part   ' };
            const page: any = { id: 15 };
            const context = new EntriesContext('\n');
            context.addEntry({ arabic: 'Previous content', from: 10 });

            appendNewPageToLastEntry(line, page, context);

            expect(context.result[1].arabic).toBe('Second part');
        });

        it('should return undefined when page gap is 1 or less', () => {
            const line: Line = { text: 'Next page content' };
            const page: any = { id: 11 };
            const context = new EntriesContext('\n');
            context.addEntry({ arabic: 'Previous content', from: 11 });

            const result = appendNewPageToLastEntry(line, page, context);

            expect(result).toBeUndefined();
            expect(context.result).toHaveLength(1);
        });
    });

    describe('processTranslation', () => {
        it('should pick up the translation marker', () => {
            const translations: Translation[] = [];

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
            const translations: Translation[] = [];

            processTranslation('A line', translations);

            expect(translations).toBeEmpty();
        });

        it('should convert all uppercase text to title case', () => {
            const translations: Translation[] = [];

            processTranslation('B1 - ALL UPPERCASE TEXT', translations);

            expect(translations[0].text).toBe('All Uppercase Text');
        });

        it('should not convert mixed case text', () => {
            const translations: Translation[] = [];

            processTranslation('B1 - Mixed Case Text', translations);

            expect(translations[0].text).toBe('Mixed Case Text');
        });

        it('should trim translation text', () => {
            const translations: Translation[] = [];

            processTranslation('B1 -   Trimmed Text   ', translations);

            expect(translations[0].text).toBe('Trimmed Text');
        });

        it('should handle en dash', () => {
            const translations: Translation[] = [];

            processTranslation('B1 – Text with en dash', translations);

            expect(translations[0].id).toBe('B1');
            expect(translations[0].text).toBe('Text with en dash');
        });

        it('should handle em dash', () => {
            const translations: Translation[] = [];

            processTranslation('B1 — Text with em dash', translations);

            expect(translations[0].id).toBe('B1');
            expect(translations[0].text).toBe('Text with em dash');
        });

        it('should handle optional space before dash', () => {
            const translations: Translation[] = [];

            processTranslation('B1-No space', translations);

            expect(translations[0].id).toBe('B1');
            expect(translations[0].text).toBe('No space');
        });

        it('should return true when translation is processed', () => {
            const translations: Translation[] = [];

            const result = processTranslation('B1 - Text', translations);

            expect(result).toBe(true);
        });

        it('should return undefined when translation is not processed', () => {
            const translations: Translation[] = [];

            const result = processTranslation('Not a marker', translations);

            expect(result).toBeUndefined();
        });
    });

    describe('appendToLastTranslation', () => {
        it('should append line to last translation text', () => {
            const translations = [{ id: 'B1', text: 'First line' }];

            const result = appendToLastTranslation('Second line', translations);

            expect(result).toBe(true);
            expect(translations[0].text).toBe('First line\nSecond line');
        });

        it('should trim appended line', () => {
            const translations = [{ id: 'B1', text: 'First line' }];

            appendToLastTranslation('   Second line   ', translations);

            expect(translations[0].text).toBe('First line\nSecond line');
        });

        it('should handle multiple appends', () => {
            const translations = [{ id: 'B1', text: 'First line' }];

            appendToLastTranslation('Second line', translations);
            appendToLastTranslation('Third line', translations);

            expect(translations[0].text).toBe('First line\nSecond line\nThird line');
        });

        it('should always return true', () => {
            const translations = [{ id: 'B1', text: 'First line' }];

            const result = appendToLastTranslation('Second line', translations);

            expect(result).toBe(true);
        });
    });
});
