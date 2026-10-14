import type { Entry } from '@/api/entries.js';

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
            this.usedIndices.add(e.index);
        }

        if (e.id) {
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
