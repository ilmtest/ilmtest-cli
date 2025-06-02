import { input } from '@inquirer/prompts';
import {
    type BoundingBox,
    buildTextBlocksFromOCR,
    mapSuryaPageResultToObservations,
    type Observation,
    type SuryaPageOcrResult,
} from 'kokokor';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import logger from '../utils/logger.js';
import { sanitizeInput } from '../utils/textUtils.js';

type MacOCR = { observations: Observation[] };

type Metadata = {
    dpi: BoundingBox;
    horizontal_lines?: BoundingBox[];
    rectangles?: BoundingBox[];
};

type SuryaPage = SuryaPageOcrResult & {
    page: number;
};


export const compileManuscript = async (folder?: string) => {
    const dataFolder =
        folder ||
        sanitizeInput(
            await input({
                message: 'Enter the folder which contains the OCR data',
                required: true,
                transformer: (val) => sanitizeInput(val),
                validate: async (input) => {
                    const f = sanitizeInput(input);

                    try {
                        const inputStats = await fs.stat(f);

                        if (inputStats.isDirectory()) {
                            if (!(await Bun.file(path.join(dataFolder, 'batch_output.json')).exists())) {
                                return 'macOCR observations not found.';
                            }

                            if (!(await Bun.file(path.join(dataFolder, 'structures.json')).exists())) {
                                return 'structures result not found.';
                            }

                            if (!(await Bun.file(path.join(dataFolder, 'results.json')).exists())) {
                                return 'surya observations not found.';
                            }

                            return true;
                        }

                        return 'Please enter a valid directory.';
                    } catch {
                        return 'Directory not found. Please enter a valid directory.';
                    }
                },
            }),
        );

    const fileToObservations: Record<string, MacOCR> = await Bun.file(
        path.join(dataFolder, 'batch_output.json'),
    ).json();
    const structures: Record<string, Metadata> = (await Bun.file(path.join(dataFolder, 'structures.json')).json())
        .result;
    const [surya] = Object.values(await Bun.file(path.join(dataFolder, 'results.json')).json()) as SuryaPage[][];

    const result = Object.entries(fileToObservations)
        .map(([imageFile, macOCRData]) => {
            const name = path.parse(imageFile).name.substring(1); // discard leading -
            const pageNumber = parseInt(name);
            const suryaPage = surya.find((s) => s.page === pageNumber)!;
            const structure = structures[imageFile];
            const alternateObservations = mapSuryaPageResultToObservations(suryaPage);

            const blocks = buildTextBlocksFromOCR(
                {
                    alternateObservations,
                    dpi: structure.dpi,
                    ...(structure.horizontal_lines && { horizontalLines: structure.horizontal_lines }),
                    ...(structure.rectangles && { rectangles: structure.rectangles }),
                    observations: macOCRData.observations,
                },
                { minMarginRatio: 0.2 },
            );

            return { blocks, page: pageNumber };
        })
        .toSorted((a, b) => a.page - b.page);

    logger.info('Writing output.json');
    await Bun.file('output.json').write(
        JSON.stringify(
            { contractVersion: 'v0.1', createdAt: new Date(), data: result, lastUpdatedAt: new Date() },
            null,
            2,
        ),
    );
};
