import { describe, expect, it } from 'bun:test';
import path from 'node:path';

import { getMediasAlreadyDownloaded, getMissingMedias, getUnprocessedVolumes, mapFidToOutputFile } from './fidUtils';

describe('fidUtils', () => {
    describe('getUnprocessedVolumes', () => {
        it('should return all fids that were not already saved', () => {
            const actual = getUnprocessedVolumes(
                [
                    { id: 'abcd', volume: 1 },
                    { id: 'efg', volume: 2 },
                ],
                ['1.json'],
            );
            expect(actual).toEqual([{ id: 'efg', volume: 2 }]);
        });

        it('should return empty array if everything was already transcribed', () => {
            const actual = getUnprocessedVolumes(
                [
                    { id: 'abcd', volume: 1 },
                    { id: 'efg', volume: 2 },
                ],
                ['1.json', '2.json'],
            );
            expect(actual).toBeEmpty();
        });
    });

    describe('mapFidToOutputFile', () => {
        it('should map the fid to the output file with a directory', () => {
            const actual = mapFidToOutputFile({ id: '1', volume: 1 }, 'folder');
            expect(actual).toEqual(path.join('folder', '1.json'));
        });

        it('should map the fid to the output file with no directory', () => {
            const actual = mapFidToOutputFile({ id: '1', volume: 1 }, '');
            expect(actual).toEqual('1.json');
        });
    });

    describe('getMissingMedias', () => {
        it('should filter out the media that was already downloaded', () => {
            const actual = getMissingMedias([{ id: '1', volume: 1 }], ['1.mp4']);
            expect(actual).toBeEmpty();
        });

        it('should filter out the wav files that was already pre-processed', () => {
            const actual = getMissingMedias([{ id: '1', volume: 1 }], ['1.wav']);
            expect(actual).toBeEmpty();
        });

        it('should return the values if nothing was pre-processed or downloaded', () => {
            const actual = getMissingMedias([{ id: '1', volume: 1 }], ['2.json']);
            expect(actual).toEqual([{ id: '1', volume: 1 }]);
        });
    });

    describe('getMediasAlreadyDownloaded', () => {
        it('should map the file name to the id', () => {
            const actual = getMediasAlreadyDownloaded([{ id: '1', volume: 1 }], ['1.mp4']);
            expect(actual).toEqual([{ id: '1.mp4', volume: 1 }]);
        });

        it('should map the wav files that was already pre-processed', () => {
            const actual = getMediasAlreadyDownloaded([{ id: '1', volume: 1 }], ['1.wav']);
            expect(actual).toEqual([{ id: '1.wav', volume: 1 }]);
        });

        it('should return empty array if nothing was downloaded', () => {
            const actual = getMediasAlreadyDownloaded([{ id: '1', volume: 1 }], ['2.wav']);
            expect(actual).toBeEmpty();
        });
    });
});
