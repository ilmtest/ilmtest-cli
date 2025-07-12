export type ConversationData = {
    create_time: number;
    mapping: Record<string, MappingNode>;
    title: string;
    update_time: number;
};

export type FileMatch = {
    data: ConversationData;
    fileName: string;
    filePath: string;
    title: string;
};

export type MappingNode = {
    children: string[];
    id: string;
    message: Message | null;
    parent: null | string;
};

export type Message = {
    author: {
        metadata: Record<string, any>;
        name: null | string;
        role: string;
    };
    channel: null | string;
    content: MessageContent;
    create_time: number;
    end_turn: boolean | null;
    id: string;
    metadata: {
        default_model_slug?: string;
        model_slug?: string;
    };
    recipient: string;
    status: string;
    update_time: null | number;
    weight: number;
};

export type MessageContent = {
    content_type: string;
    parts: string[];
};
