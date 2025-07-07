import config from '../utils/config.js';
import { changeEndpointName, doGet, doPut } from './index.js';

export type Entry = {
    arabic?: string;
    collection: number;
    flags?: number;
    from: number;
    id: number;
    index?: number;
    pp: number;
    translation?: string;
    translator?: number;
    type?: number;
    volume: number;
};

type RawEntry = {
    ar_body: string;
    body: string;
    collection: string;
    flags?: string;
    from_page: string;
    id: number;
    index_number?: number;
    part_number: number;
    part_page: number;
    translator?: number;
    type?: number;
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
        id: rawEntry.id,
        pp: rawEntry.part_page,
        translation: rawEntry.body,
        volume: rawEntry.part_number,
        ...(rawEntry.flags && { flags: Number(rawEntry.flags) }),
        ...(rawEntry.index_number && { index: rawEntry.index_number }),
        ...(rawEntry.translator && { translator: rawEntry.translator }),
        ...(rawEntry.type && { translator: rawEntry.type }),
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
        ...(entry.from && { from_page: String(entry.from) }),
        ...(entry.arabic && { ar_body: entry.arabic }),
        ...(entry.id && { id: entry.id }),
        ...(entry.collection && { collection: String(entry.collection) }),
        ...(entry.volume && { part_number: entry.volume }),
        ...(entry.pp && { part_page: entry.pp }),
        ...(entry.flags && { flags: String(entry.flags) }),
        ...(entry.index && { index_number: entry.index }),
        ...(entry.type && { type: entry.type }),
        ...(entry.translator && { translator: entry.translator }),
    };
};

/**
 * Retrieves all entries for a given collection
 * @param collectionId - The ID of the collection to fetch entries for
 * @returns Promise that resolves to an array of Entry objects
 */
export const getEntries = async (collectionId: string): Promise<Entry[]> => {
    const data: RawEntry[] = await doGet(changeEndpointName(config.collectionsEndpoint, 'entries'), {
        collection: collectionId,
        limit: 999999,
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
