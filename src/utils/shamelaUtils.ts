import { parseHTML } from 'linkedom';

interface ParsedContent {
    id?: string;
    text: string;
}

// Main parsing function - handles spans that appear mid-line
export function parseContentRobust(content: string): ParsedContent[] {
    const result: ParsedContent[] = [];

    if (!/<span[^>]*>/i.test(content)) {
        return parseContentWithoutSpans(content);
    }

    // Parse HTML using linkedom
    const { document } = parseHTML(`<div>${content}</div>`);
    const container = document.querySelector('div')!;

    // Process each child node in order
    for (const node of container.childNodes) {
        if (node.nodeType === 3) {
            // Text node
            const text = node.textContent?.trim();
            if (text) {
                result.push(...processTextContent(text));
            }
        } else if (node.nodeType === 1) {
            // Element node
            const element = node as Element;

            if (element.tagName.toLowerCase() === 'span' && element.getAttribute('data-type') === 'title') {
                // Extract ID (remove 'toc-' prefix if present)
                const id = element.getAttribute('id')?.replace(/^toc-/, '') || '';

                // Get all text content (automatically handles nested spans)
                const text = element.textContent?.trim() || '';

                result.push({
                    id,
                    text,
                });
            } else {
                // Handle other elements as text content
                const text = element.textContent?.trim();
                if (text) {
                    result.push(...processTextContent(text));
                }
            }
        }
    }

    return result;
}

// Helper: no spans path
function parseContentWithoutSpans(content: string): ParsedContent[] {
    return splitIntoLines(content).map((line) => ({ text: line }));
}

// Helper: text chunks between titles
function processTextContent(content: string): ParsedContent[] {
    return splitIntoLines(content).map((line) => ({ text: line }));
}

// Clean + split into lines (robust to CR-only and missing breaks)
function splitIntoLines(text: string): string[] {
    // 1) Normalize all break styles to LF
    let normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // 2) If still a single line, add ONE soft break after the first sentence-ending punctuation
    //    followed by Arabic text. This preserves your intended break at:  ...". قَالَ ...
    if (!/\n/.test(normalized)) {
        normalized = normalized.replace(/([.?!\u061F\u061B\u06D4\u2026]["“”'’»«)\]]?)\s+(?=[\u0600-\u06FF])/, '$1\n');
    }

    return normalized
        .split('\n')
        .map((line) => line.replace(/^\*+/, '').trim())
        .filter(Boolean);
}

export const removeFootnoteReferencesSimple = (text: string): string => {
    // This version removes footnotes and normalizes spaces
    return text.replace(/\s*\(\u00AC[\u0660-\u0669]+\)\s*/g, ' ').replace(/ +/g, ' '); // Normalize multiple spaces to single space
};

export const removeSingleDigitFootnoteReferences = (text: string): string => {
    // This version removes footnotes and normalizes spaces
    return text.replace(/\s*\([٠-٩]{1}\)\s*/g, ' ').replace(/ +/g, ' '); // Normalize multiple spaces to single space
};

export const sanitizePageContent = (text: string) => {
    let content =
        /*removeSingleDigitFootnoteReferences(text)*/
        removeFootnoteReferencesSimple(text)
            .replace(/舄/g, '')
            .replace(/<img[^>]*>>/, '');
    const indexOfFootnote = content.lastIndexOf('_________');

    if (indexOfFootnote >= 0) {
        content = content.slice(0, indexOfFootnote);
    }

    return content;
};
