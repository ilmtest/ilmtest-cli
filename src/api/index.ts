import { fetch } from 'bun';
import { URL, URLSearchParams } from 'node:url';

import logger from '../utils/logger.js';

export const doGet = async (endpoint: string, params: Record<string, any>) => {
    const url = new URL(endpoint);
    url.search = new URLSearchParams(params).toString();

    logger.debug(`GET ${url}`);

    const response = await fetch(url as any);
    const result: any = await response.json();

    logger.debug(`Success response ${url}`);

    return result;
};

export interface PagingParams {
    before?: string;
    limit?: number;
}
