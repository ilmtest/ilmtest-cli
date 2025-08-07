import type { Page } from '@/api/maktabah.js';

// The data structures that we are building
export type IndexingState = {
    indexToBab: Record<string, Page>;
    indexToKitab: Record<string, Page>;
    indexToMatn: Record<string, Page>;
    lastIndex: string;
};

// The interface for a processor function.
export type PageProcessor = (context: ProcessorContext) => ProcessorResult;

// The context object passed to each processor on each page.
// It contains the current page, the body text to be processed, and the shared state.
type ProcessorContext = {
    body: string;
    page: Page;
    state: IndexingState;
};

// The result returned by each processor.
// It must return the new body (which may be modified or not) and can optionally
// signal to the runner to stop processing the current page.
type ProcessorResult = {
    body: string;
    stopProcessing?: boolean;
};
