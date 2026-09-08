import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/global-setup.ts'],
    // Un solo hilo: los tests comparten la BD de desarrollo.
    pool: 'threads',
    poolOptions: { threads: { singleThread: true } },
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
