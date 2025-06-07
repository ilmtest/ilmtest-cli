import { input } from '@inquirer/prompts';
import {
    alignAndAdjustObservations,
    type BoundingBox,
    buildTextBlocksFromOCR,
    calculateDPI,
    mapSuryaBoundingBox,
    mapSuryaPageResultToObservations,
    type Observation,
    type SuryaPageOcrResult,
} from 'kokokor';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { Manuscript } from '../types.js';

import logger from '../utils/logger.js';
import { sanitizeInput } from '../utils/textUtils.js';

type MacOCR = { observations: Observation[] };

type Metadata = {
    readonly dpi: BoundingBox;
    readonly horizontal_lines?: BoundingBox[];
    readonly rectangles?: BoundingBox[];
};

const getSourceFolder = async () => {
    return sanitizeInput(
        await input({
            message: 'Enter the folder which contains the OCR data',
            required: true,
            transformer: (val) => sanitizeInput(val),
            validate: async (input) => {
                const f = sanitizeInput(input);

                try {
                    const inputStats = await fs.stat(f);

                    if (inputStats.isDirectory()) {
                        if (!(await Bun.file(path.join(f, 'batch_output.json')).exists())) {
                            return 'macOCR observations not found.';
                        }

                        if (!(await Bun.file(path.join(f, 'structures.json')).exists())) {
                            return 'structures result not found.';
                        }

                        if (!(await Bun.file(path.join(f, 'results.json')).exists())) {
                            return 'surya observations not found.';
                        }

                        return true;
                    }

                    return 'Please enter a valid directory.';
                } catch (err) {
                    console.error(err);
                    return 'Directory not found. Please enter a valid directory.';
                }
            },
        }),
    );
};

export const compileManuscript = async (folder?: string) => {
    const dataFolder = folder || (await getSourceFolder());

    const fileToObservations: Record<string, MacOCR> = await Bun.file(
        path.join(dataFolder, 'batch_output.json'),
    ).json();
    const structures: Record<string, Metadata> = (await Bun.file(path.join(dataFolder, 'structures.json')).json())
        .result;
    const [surya] = Object.values(await Bun.file(path.join(dataFolder, 'surya.json')).json()) as SuryaPageOcrResult[][];
    const [pdfWidth, pdfHeight] = (await Bun.file(path.join(dataFolder, 'page_size.txt')).text())
        .trim()
        .split(' ')
        .map(Number);

    const result = Object.entries(fileToObservations)
        .map(([imageFile, macOCRData]) => {
            const name = path.parse(imageFile).name;
            const pageNumber = parseInt(name);
            const suryaPage = surya.find((s) => s.page === pageNumber);

            if (!suryaPage) {
                throw new Error(`No Surya page data found for page ${pageNumber} (file: ${imageFile})`);
            }

            const { height: imageHeight, width: imageWidth } = mapSuryaBoundingBox(suryaPage.image_bbox);
            const { x: dpiX, y: dpiY } = calculateDPI(
                { height: imageHeight, width: imageWidth },
                { height: pdfHeight, width: pdfWidth },
            );

            const { dpi, horizontal_lines: lines, rectangles } = structures[imageFile];
            const alternateObservations = mapSuryaPageResultToObservations(suryaPage);

            const blocks = buildTextBlocksFromOCR(
                {
                    alternateObservations: alignAndAdjustObservations(alternateObservations, {
                        dpiX,
                        dpiY,
                        imageWidth: imageWidth,
                    }).observations,
                    dpi,
                    ...(lines && { horizontalLines: lines }),
                    ...(rectangles && { rectangles }),
                    observations: macOCRData.observations,
                },
                { log: console.log, typoSymbols: ['ﷺ'] },
            );

            return { blocks, ...(lines && { lines }), ...(rectangles && { rectangles }), page: pageNumber };
        })
        .toSorted((a, b) => a.page - b.page);

    const [struct] = Object.values(structures);

    const outputData = {
        contractVersion: 'v0.1',
        createdAt: new Date(),
        data: result,
        lastUpdatedAt: new Date(),
        metadata: {
            image: { height: struct.dpi.height, width: struct.dpi.width },
            pdf: { height: pdfHeight, width: pdfWidth },
        },
    } satisfies Manuscript;

    logger.info('Writing output.json');
    await Bun.file('output.json').write(JSON.stringify(outputData, null, 2));
};
