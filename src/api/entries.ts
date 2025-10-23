import config from '../utils/config.js';
import { changeEndpointName, doGet, doPut, type PagingParams } from './index.js';

/**
 * Flags that can be applied to entries
 */
export enum EntryFlags {
    PendingReview = 3,
    VerifyTranslation = 4,
}

/**
 * Types of entries in the system
 */
export enum EntryType {
    Book = 1,
    Chapter = 2,
}

export type Entry = {
    arabic?: string;
    collection: number;
    explains?: string[];
    commentary?: string;
    flags?: EntryFlags;
    fromEndIndex?: number;
    from: number;
    id: string;
    index?: number;
    pp: number;
    to?: number;
    translation?: string;
    translator?: number;
    type?: EntryType;
    url?: string;
    volume: number;
};

/**
 * Raw entry data structure as received from the API
 */
type RawEntry = {
    ar_body: string;
    body: string;
    collection: string;
    commentary?: string;
    flags?: string;
    from_page: string;
    id: number;
    index_number?: number;
    part_number: number;
    part_page: number;
    to_page?: number;
    translator?: number;
    type?: string;
    url?: string;
};

/**
 * Maps a raw entry from the API to the internal Entry format
 * @param rawEntry - The raw entry object from the API
 * @returns The mapped Entry object
 */
const mapRawEntryToEntry = (rawEntry: RawEntry): Entry => {
    return {
        arabic: rawEntry.ar_body,
        collection: Number(rawEntry.collection),
        from: Number(rawEntry.from_page),
        id: String(rawEntry.id),
        pp: rawEntry.part_page,
        translation: rawEntry.body,
        volume: rawEntry.part_number,
        ...(rawEntry.flags && { flags: Number(rawEntry.flags) }),
        ...(rawEntry.index_number && { index: rawEntry.index_number }),
        ...(rawEntry.commentary && { commentary: rawEntry.commentary }),
        ...(rawEntry.to_page && { to: rawEntry.to_page }),
        ...(rawEntry.translator && { translator: rawEntry.translator }),
        ...(rawEntry.type && { type: Number(rawEntry.type) }),
        ...(rawEntry.url && { url: rawEntry.url }),
    };
};

/**
 * Maps an internal Entry object to the raw entry format expected by the API
 * @param entry - The internal Entry object
 * @returns The mapped RawEntry object
 */
const mapEntryToRawEntry = (entry: Partial<Entry>): Partial<RawEntry> => {
    return {
        ...(entry.translation && { body: entry.translation }),
        ...((entry.from !== undefined && { from_page: entry.from ? entry.from.toString() : null }) as any),
        ...(entry.to && { to_page: entry.to }),
        ...(entry.arabic && { ar_body: entry.arabic }),
        ...(entry.commentary && { commentary: entry.commentary }),
        ...(entry.id && { id: Number(entry.id) }),
        ...(entry.collection && { collection: String(entry.collection) }),
        ...(entry.volume !== undefined && { part_number: entry.volume }),
        ...(entry.explains && { explains: entry.explains.join(',') }),
        ...(entry.pp !== undefined && { part_page: entry.pp }),
        ...(entry.flags && { flags: String(entry.flags) }),
        ...(entry.index && { index_number: entry.index }),
        ...(entry.type && { type: String(entry.type) }),
        ...(entry.url && { url: entry.url }),
        ...(entry.translator && { translator: entry.translator }),
    };
};

/**
 * Parameters for getting entries with optional type filtering
 */
interface GetEntriesParams extends PagingParams {
    type?: number;
}

/**
 * Retrieves all entries for a given collection
 * @param collectionId - The ID of the collection to fetch entries for
 * @returns Promise that resolves to an array of Entry objects
 */
export const getEntries = async (collectionId: string, options: GetEntriesParams = {}): Promise<Entry[]> => {
    const data: RawEntry[] = await doGet(changeEndpointName(config.collectionsEndpoint, 'entries'), {
        collection: collectionId,
        ...options,
    });

    return data.map(mapRawEntryToEntry);
};

/**
 * Adds an entry (if id is not provided), or updates an existing entry using a PUT request.
 * @param entry - The Entry object to update
 * @returns Promise that resolves to the updated entry data from the server
 */
export const addOrUpdateEntry = async (entry: Partial<Entry>) => {
    const rawEntry = mapEntryToRawEntry(entry);
    const endpoint = changeEndpointName(config.collectionsEndpoint, 'entries');

    return doPut(endpoint, rawEntry, { user_id: '1' });
};
