import { getArabicScore } from 'bitaboom';
import { type BoundingBox, mapObservationsToTextLines, type Observation, type Size } from 'kokokor';

import { getFileSystemInput, validateJsonFile } from '@/utils/io.js';

/**
 * 2D coordinate representation
 */
type Coordinate = {
    x: number;
    y: number;
};

/**
 * OCR data structure containing DPI information and page observations
 */
type OCRData = {
    dpi: Coordinate;
    pages: {
        height: number;
        observations: Observation[];
        page: number;
        width: number;
    }[];
};

/**
 * Structured page data with optional layout elements
 */
type StructPage = Size & {
    horizontal_lines?: BoundingBox[];
    page: number;
    rectangles?: BoundingBox[];
};

/**
 * Document structure data containing page layouts and DPI information
 */
type Structures = {
    dpi: Coordinate;
    pages: StructPage[];
};

/**
 * Extracts and processes text from OCR and structure data files
 * Filters Arabic text, maps observations to text lines, and generates translation output
 * @returns Promise that resolves when extraction and file writing completes
 */
export const extractor = async () => {
    const ocrFile = await getFileSystemInput({ message: 'OCR path:', validate: validateJsonFile });
    const structuresFile = await getFileSystemInput({ message: 'Structures path:', validate: validateJsonFile });
    const ocrData = (await Bun.file(ocrFile).json()) as OCRData;
    const structures = (await Bun.file(structuresFile).json()) as Structures;

    const lines = ocrData.pages
        //.filter((p) => p.page === 5 || p.page === 6)
        .flatMap((page) => {
            const structure = structures.pages.find((p) => p.page === page.page);

            const textLines = mapObservationsToTextLines(
                page.observations.filter((o) => getArabicScore(o.text) < 0.8),
                { ...ocrData.dpi, height: page.height, width: page.width },
                {
                    horizontalLines:
                        (structure?.horizontal_lines || []).length === 1 ? structure?.horizontal_lines : undefined,
                    isRTL: false,
                    rectangles: structure?.rectangles,
                },
            )
                .map((t) => ({ ...t, page: page.page }))
                .filter((p) => !p.isFootnote);

            return textLines.map((t) => t.text);
        });

    const result: string[] = [];
    let capture = true;

    const processedIndices = new Set<string>();

    lines.forEach((l) => {
        const [index] = l.match(/^(\d+)/) || [];

        if (l.includes('Chapter') || (index && !processedIndices.has(index))) {
            result.push(l);
            capture = true;

            if (index) {
                processedIndices.add(index);
            }
        } else if (l.includes('Comments')) {
            capture = false;
        } else if (capture) {
            result[result.length - 1] = `${result[result.length - 1]} ${l}`;
        }
    });

    await Bun.file('translation.txt').write(result.join('\n\n'));
};
