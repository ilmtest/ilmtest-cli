import { type BoundingBox, mapObservationsToTextLines, type Observation, type Size } from 'kokokor';

import { getFileSystemInput, validateJsonFile } from '@/utils/io.js';
import { getArabicScore } from '@/utils/textUtils.js';

type Coordinate = {
    x: number;
    y: number;
};

type OCRData = {
    dpi: Coordinate;
    pages: {
        height: number;
        observations: Observation[];
        page: number;
        width: number;
    }[];
};

type StructPage = Size & {
    horizontal_lines?: BoundingBox[];
    page: number;
    rectangles?: BoundingBox[];
};

type Structures = {
    dpi: Coordinate;
    pages: StructPage[];
};

export const extractor = async () => {
    const ocrFile =
        '/Users/rhaq/Downloads/ocr.json' ||
        (await getFileSystemInput({ message: 'OCR path:', validate: validateJsonFile }));
    const structuresFile =
        '/Users/rhaq/Downloads/structures.json' ||
        (await getFileSystemInput({ message: 'Structures path:', validate: validateJsonFile }));
    const ocrData = (await Bun.file(ocrFile).json()) as OCRData;
    const structures = (await Bun.file(structuresFile).json()) as Structures;

    const lines = ocrData.pages.flatMap((page) => {
        const structure = structures.pages.find((p) => p.page === page.page);

        const textLines = mapObservationsToTextLines(
            page.observations.filter((o) => getArabicScore(o.text) < 0.8),
            { ...ocrData.dpi, height: page.height, width: page.width },
            {
                horizontalLines:
                    (structure?.horizontal_lines || []).length === 1 ? structure?.horizontal_lines : undefined,
                rectangles: structure?.rectangles,
            },
        )
            .map((t) => ({ ...t, page: page.page }))
            .filter((p) => !p.isFootnote);

        return textLines.map((t) => t.text);
    });

    const result: string[] = [];

    lines.forEach((l) => {
        if (l.includes('Chapter') || l.match(/^\d+/)) {
            result.push(l);
        } else {
            result[result.length - 1] = result[result.length - 1] + ' ' + l;
        }
    });

    await Bun.file('translation.txt').write(result.join('\n\n'));
};
