import { parseHTML } from 'linkedom';

export type Line = {
    id?: string;
    text: string;
};

const mergeDanglingPunctuation = (lines: Line[]) => {
    // ) ] » ” ’ " . , ? ! : ؛ ، Arabic ? ; full stop … etc.
    const PUNCT_ONLY = /^[)\]\u00BB"”'’.,?!:\u061B\u060C\u061F\u06D4\u2026]+$/;

    const out: Line[] = [];
    for (const item of lines) {
        const last = out[out.length - 1];

        // Merge only when previous line is a title (has an id) and current "line" is pure punctuation
        if (last && (last as any).id && PUNCT_ONLY.test(item.text)) {
            // Respect existing trailing space from the title text (we preserved it below)
            (last as any).text += item.text;
        } else {
            out.push(item);
        }
    }
    return out;
};

const processTextContent = (content: string): Line[] => {
    return splitIntoLines(content).map((line) => ({ text: line }));
};

const splitIntoLines = (text: string) => {
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
};

// Main parsing function - handles spans that appear mid-line
export function parseContentRobust(content: string) {
    const result: Line[] = [];

    if (!/<span[^>]*>/i.test(content)) {
        return processTextContent(content);
    }

    const { document } = parseHTML(`<div>${content}</div>`);
    const container = document.querySelector('div')!;

    for (const node of container.childNodes) {
        if (node.nodeType === 3) {
            const text = (node.textContent ?? '').trim();

            if (text) {
                result.push(...processTextContent(text));
            }
        } else if (node.nodeType === 1) {
            const element = node as Element;

            if (element.tagName.toLowerCase() === 'span' && element.getAttribute('data-type') === 'title') {
                const id = element.getAttribute('id')?.replace(/^toc-/, '') || '';

                // IMPORTANT: keep trailing spaces so punctuation outside the span
                // can attach with that space preserved.
                const rawTitle = element.textContent ?? '';
                const text = rawTitle.replace(/^\s+/, ''); // drop only leading, not trailing

                result.push({ id, text });
            } else {
                const text = element.textContent?.trim();
                if (text) {
                    result.push(...processTextContent(text));
                }
            }
        }
    }

    return mergeDanglingPunctuation(result);
}

export const removeFootnoteReferencesSimple = (text: string): string => {
    // This version removes footnotes and normalizes spaces
    return text.replace(/\s*\(\u00AC[\u0660-\u0669]+\)\s*/g, ' ').replace(/ +/g, ' '); // Normalize multiple spaces to single space
};

export const removeSingleDigitFootnoteReferences = (text: string): string => {
    // This version removes footnotes and normalizes spaces
    return text.replace(/\s*\([٠-٩]{1}\)\s*/g, ' ').replace(/ +/g, ' '); // Normalize multiple spaces to single space
};

const FOOTNOTE_MARKER = '_________';

export const sanitizePageContent = (text: string) => {
    let content = text.replace(/舄/g, '').replace(/<img[^>]*>>/, '');
    let footnote = '';
    const indexOfFootnote = content.lastIndexOf(FOOTNOTE_MARKER);

    if (indexOfFootnote >= 0) {
        footnote = content.slice(indexOfFootnote + FOOTNOTE_MARKER.length);
        content = content.slice(0, indexOfFootnote);
    }

    content = removeSingleDigitFootnoteReferences(content);
    content = removeFootnoteReferencesSimple(content);

    return [content, footnote];
};
