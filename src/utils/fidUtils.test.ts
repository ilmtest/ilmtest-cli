import { describe, expect, it } from 'bun:test';
import path from 'node:path';

import { getMediasNotDownloaded, getRemainingMedia, getUnprocessedVolumes, mapFidToOutputFile } from './fidUtils';

describe('fidUtils', () => {
    describe('getRemainingMedia', () => {
        it('should filter out the ones that already were transcribed and saved', () => {
            const actual = getRemainingMedia(
                [
                    { id: '1', volume: 1 },
                    { id: '2', volume: 2 },
                ],
                [{ id: '1', volume: 1 }],
                [],
            );

            expect(actual).toEqual([{ id: '2', volume: 2 }]);
        });

        it('should work if nothing was transcribed', () => {
            const actual = getRemainingMedia([{ id: '1', volume: 1 }], [], []);
            expect(actual).toEqual([{ id: '1', volume: 1 }]);
        });

        it('should return empty array if everything was already transcribed', () => {
            const actual = getRemainingMedia([{ id: '1', volume: 1 }], [{ id: '1', volume: 1 }], []);
            expect(actual).toBeEmpty();
        });
    });

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

    describe('getMediasNotDownloaded', () => {
        it('should filter out the media that was already downloaded', () => {
            const actual = getMediasNotDownloaded([{ id: '1', volume: 1 }], ['1.mp4']);
            expect(actual).toBeEmpty();
        });

        it('should filter out the wav files that was already pre-processed', () => {
            const actual = getMediasNotDownloaded([{ id: '1', volume: 1 }], ['1.wav']);
            expect(actual).toBeEmpty();
        });

        it('should return the values if nothing was pre-processed or downloaded', () => {
            const actual = getMediasNotDownloaded([{ id: '1', volume: 1 }], ['2.json']);
            expect(actual).toEqual([{ id: '1', volume: 1 }]);
        });
    });
});
