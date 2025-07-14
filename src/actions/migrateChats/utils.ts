import type { ConversationData, Message } from './types.js';

// Get all text messages from a conversation, ordered by create_time
export const getTextMessages = (data: ConversationData): Message[] => {
    return Object.values(data.mapping)
        .filter(
            (node) =>
                node.message?.content.content_type === 'text' &&
                node.message.create_time &&
                node.message.author.role !== 'tool' &&
                node.message.content.parts.filter((p) => p.trim()).length,
        )
        .map((node) => node.message!);
};

// Utility function to sanitize and escape Arabic text for terminal display
export const sanitizeText = (text: string): string => {
    return text
        .split('')
        .filter((char) => {
            const code = char.charCodeAt(0);
            // Keep printable ASCII, Arabic/Unicode characters, and common whitespace
            return (
                (code >= 32 && code <= 126) || // Basic ASCII printable
                code >= 160 || // Extended ASCII and Unicode
                char === '\n' ||
                char === '\t'
            ); // Keep newlines and tabs
        })
        .join('')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .trim();
};

// Check if a message contains the search query
const messageContainsQuery = (message: Message, query: string): boolean => {
    return message.content.parts.some((part) => part.includes(query));
};

// Search for the query in a conversation's messages
export const searchInConversation = (data: ConversationData, query: string): boolean => {
    return getTextMessages(data).some((message) => messageContainsQuery(message, query));
};
