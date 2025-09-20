import { defineConfig } from 'tsup';

export default defineConfig({
    clean: true,
    dts: true,
    entry: ['src/index.ts'],
    external: ['bun', 'bun:*', '@aws-sdk/*'],
    format: ['esm'],
    minify: true,
    platform: 'node',
    sourcemap: true,
    target: 'node22',
});
