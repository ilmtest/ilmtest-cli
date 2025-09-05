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

    // Span + trailing punctuation (no CR/LF)
    const titleRegex =
        /<span[^>]*data-type=["']?title["']?[^>]*id=toc-([^>"'\s]+)[^>]*>([^<]*)<\/span>([^\S\r\n]*[.?!:;،؛\u060C\u061B\u061F\u06D4\u2026"“”'’»«)\]]+)?/g;

    let lastIndex = 0;
    let match: null | RegExpExecArray;

    while ((match = titleRegex.exec(content)) !== null) {
        const matchIndex = match.index;

        if (matchIndex > lastIndex) {
            const beforeSpan = content.substring(lastIndex, matchIndex);
            const cleanedBeforeSpan = beforeSpan.replace(/\s*\*\s*$/, '').trim();
            if (cleanedBeforeSpan) {
                result.push(...processTextContent(cleanedBeforeSpan));
            }
        }

        const id = (match[1] || '').replace(/['"]/g, '');
        const spanText = match[2] || '';
        const trailing = (match[3] || '').replace(/^\s+/, '');

        result.push({
            id,
            text: (spanText + trailing).trim(),
        });

        lastIndex = titleRegex.lastIndex;
    }

    if (lastIndex < content.length) {
        const remainingContent = content.substring(lastIndex);
        result.push(...processTextContent(remainingContent));
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
