import type { Entry } from '@/api/entries.js';
import logger from './logger.js';

export class EntriesContext {
    private entries: Partial<Entry>[];
    private usedIndices: Set<number>;
    private usedIds: Set<string>;
    private lineSeparator: string;

    constructor(lineSeparator: string) {
        this.entries = [];
        this.usedIndices = new Set();
        this.usedIds = new Set();
        this.lineSeparator = lineSeparator;
    }

    addEntry = (e: Partial<Entry>) => {
        this.entries.push(e);

        if (e.index) {
            if (this.usedIndices.has(e.index)) {
                logger.warn(`Duplicate index ${e.index} being added at ${e.from}`);
            }

            this.usedIndices.add(e.index);
        }

        if (e.id) {
            if (this.usedIds.has(e.id)) {
                logger.warn(`Duplicate id ${e.id} being added at ${e.from}`);
            }

            this.usedIds.add(e.id);
        }
    };

    get result() {
        return this.entries;
    }

    get separator() {
        return this.lineSeparator;
    }

    get lastEntry() {
        return this.entries.at(-1);
    }
}
