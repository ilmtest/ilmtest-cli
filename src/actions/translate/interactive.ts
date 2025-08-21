import { getArabicScore } from 'bitaboom';

import { Entry } from '@/api/entries.js';
import { getFileSystemInput } from '@/utils/io.js';

import type { Page } from '../../api/maktabah.js';
import type { PageRange } from './types.js';

import { createChapterEntry } from './mapping.js';
import { PATTERNS } from './patterns.js';

type WalkAndIndexPagesOptions = {
    narrationPattern: RegExp;
    stopPattern: RegExp;
};

export const walkAndIndexPages = (pages: Page[], { narrationPattern, stopPattern }: WalkAndIndexPagesOptions) => {
    const indexToMatn: Record<string, PageRange> = {};
    const indexToLines: Record<string, string[]> = {};

    let lastIndex = '';

    for (const page of pages) {
        page.body
            .split('\n')
            .filter((line) => line.trim())
            .forEach((line) => {
                // eslint-disable-next-line prefer-const
                let [, index, text] = line.match(narrationPattern) || [];

                if (text?.trim().startsWith('باب')) {
                    index = `c${index}`;
                } else if (line.startsWith('باب')) {
                    console.log('chapter without number', lastIndex);
                    lastIndex = '';
                }

                if (stopPattern.test(line)) {
                    lastIndex = '';
                } else if (index && text && !indexToMatn[index]) {
                    indexToMatn[index] = { ...page };
                    indexToLines[index] = [text];
                    lastIndex = index;
                } else if (lastIndex) {
                    indexToLines[lastIndex].push(line.trim());

                    if (indexToMatn[lastIndex].page !== page.page) {
                        indexToMatn[lastIndex].end = page.page;
                    }
                }

                if (line.endsWith('(متفق عليه).') || line.endsWith('رواه مسلم')) {
                    lastIndex = '';
                }
            });
    }

    for (const [index, texts] of Object.entries(indexToLines)) {
        indexToMatn[index] = {
            ...indexToMatn[index],
            body: texts
                .map((t) => t.trim())
                .filter(Boolean)
                .join('\n'),
        };
    }

    return indexToMatn;
};

export const walkAndIndexLines = (lines: string[], pattern = PATTERNS.MatchNumericListItem) => {
    const indexToLines: Record<string, string[]> = {};

    let lastIndex = '';

    for (const line of lines) {
        const [, index, text] = line.match(pattern) || [];

        if (index && text && !indexToLines[index]) {
            indexToLines[index] = [text];
            lastIndex = index;
        } else if (lastIndex) {
            indexToLines[lastIndex].push(line.trim());
        }
    }

    const result: Record<string, string> = {};

    for (const [index, texts] of Object.entries(indexToLines)) {
        result[index] = texts.map((t) => t.trim()).join('\n');
    }

    return result;
};

export const promptUserForPairs = async (pages: Page[], translatorId: string, dir: string) => {
    const result: Entry[] = [];

    while (true) {
        const inputFile = await getFileSystemInput({
            defaultValue: `${dir}/translation.txt`,
            message: 'Enter file with translation:',
            required: false,
            validate: () => true,
        });

        if (!inputFile) {
            break;
        }

        const content = await Bun.file(inputFile).text();

        const lines = content
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean);

        const translationLines = lines.filter((l) => getArabicScore(l) < 0.8);
        const arabicLines = lines.filter((l) => getArabicScore(l) > 0.8);

        if (translationLines.length !== arabicLines.length) {
            console.error('Uneven lines', translationLines.length, 'vs.', arabicLines.length);
            break;
        }

        const entries = arabicLines.map((a, i) => {
            const page = pages.find((p) => p.body === a)!;
            return createChapterEntry(page, translationLines[i], translatorId);
        });

        result.push(...entries);

        console.log(result.length, 'entries pending...');
    }

    return result;
};
