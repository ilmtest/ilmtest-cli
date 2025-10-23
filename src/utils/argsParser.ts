import { type ParseArgsOptionsConfig, parseArgs } from 'node:util';

export const getParsedArgs = <T extends ParseArgsOptionsConfig>(additionalOptions: T = {} as T) => {
    return parseArgs({
        allowPositionals: true,
        options: {
            compile: {
                type: 'string',
            },
            diff: {
                type: 'string',
            },
            download: {
                type: 'string',
            },
            extract: {
                type: 'boolean',
            },
            fix: {
                type: 'string',
            },
            migrate: {
                type: 'string',
            },
            save: {
                type: 'string',
            },
            shamela: {
                type: 'string',
            },
            transcribe: {
                short: 't',
                type: 'boolean',
            },
            ...additionalOptions,
        },
        strict: false,
    });
};
