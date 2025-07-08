import { URL, URLSearchParams } from 'node:url';

import logger from '../utils/logger.js';

/**
 * Performs a GET request to the specified endpoint with query parameters
 * @param endpoint - The URL endpoint to make the GET request to
 * @param params - Query parameters to append to the URL
 * @returns Promise that resolves to the JSON response from the server
 * @throws Will throw an error if the request fails or response is not valid JSON
 */
export const doGet = async (endpoint: string, params: Record<string, any>) => {
    const url = new URL(endpoint);
    url.search = new URLSearchParams(params).toString();

    logger.debug(`GET ${url}`);

    const response = await fetch(url as any);
    const result: any = await response.json();

    logger.trace(`Success response ${url}`);

    return result;
};

/**
 * Performs a POST request to the specified endpoint with a JSON body
 * @param endpoint - The URL endpoint to make the POST request to
 * @param body - The data to send in the request body (will be JSON stringified)
 * @param headers - Optional additional headers to include in the request
 * @returns Promise that resolves to the JSON response from the server
 * @throws Will throw an error if the request fails or response is not valid JSON
 */
export const doPost = async (endpoint: string, body: Record<string, any>, headers: Record<string, string> = {}) => {
    const url = new URL(endpoint);

    logger.trace(`POST ${url}`);

    const response = await fetch(url as any, {
        body: JSON.stringify(body),
        headers: {
            'Content-Type': 'application/json',
            ...headers,
        },
        method: 'POST',
    });

    const result: any = await response.json();

    logger.trace(`Success response ${url}`);

    return result;
};

/**
 * Performs a PUT request to the specified endpoint with a JSON body
 * @param endpoint - The URL endpoint to make the PUT request to
 * @param body - The data to send in the request body (will be JSON stringified)
 * @param headers - Optional additional headers to include in the request
 * @returns Promise that resolves to the JSON response from the server
 * @throws Will throw an error if the request fails or response is not valid JSON
 */
export const doPut = async (endpoint: string, body: Record<string, any>, headers: Record<string, string> = {}) => {
    const url = new URL(endpoint);

    logger.trace(`PUT ${url}`);

    const response = await fetch(url as any, {
        body: JSON.stringify({ ...body, ...(headers.user_id && { user_id: headers.user_id }) }),
        headers: {
            'Content-Type': 'application/json',
            ...headers,
        },
        method: 'PUT',
    });

    const result: any = await response.json();

    logger.trace(`Success response ${url}`);

    return result;
};

/**
 * Interface for pagination parameters commonly used in API requests
 */
export interface PagingParams {
    /** Cursor for pagination - items before this cursor */
    before?: string;
    /** Maximum number of items to return */
    limit?: number;
}

/**
 * Changes the endpoint name in a URL while preserving the file extension
 * @param originalUrl - The original URL string
 * @param newName - The new name to replace the current endpoint name with
 * @returns The modified URL string with the new endpoint name
 * @example
 * changeEndpointName('https://api.example.com/users.json', 'customers')
 * // Returns: 'https://api.example.com/customers.json'
 */
export const changeEndpointName = (originalUrl: string, newName: string) => {
    const url = new URL(originalUrl);
    url.pathname = url.pathname.replace(/\/([^/]+)(\.[^.]+)$/, `/${newName}$2`);
    return url.toString();
};
