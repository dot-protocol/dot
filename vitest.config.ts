import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@dot-protocol/core': resolve(__dirname, 'packages/core/src/index.ts'),
      '@dot-protocol/chain': resolve(__dirname, 'packages/chain/src/index.ts'),
      '@dotprotocol/compression': resolve(__dirname, 'packages/compression/src/index.ts'),
      '@dotprotocol/identity': resolve(__dirname, 'packages/identity/src/index.ts'),
      '@dotprotocol/relay': resolve(__dirname, 'packages/relay/src/index.ts'),
      '@dotprotocol/wrapper': resolve(__dirname, 'packages/wrapper/src/index.ts'),
      '@dotprotocol/qr': resolve(__dirname, 'packages/qr/src/index.ts'),
      '@dotprotocol/arena': resolve(__dirname, 'packages/arena/src/index.ts'),
    },
  },
  test: {
    globals: true,
    include: ['packages/*/src/**/*.test.ts', 'packages/*/tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/__tests__/**'],
    },
  },
});
