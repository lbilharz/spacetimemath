import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    globalSetup: ['src/__tests__/global-setup.ts'],
    include: ['src/__tests__/integration/**/*.test.ts'],
    // Each integration test can take a while — generous timeout
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Run test files sequentially to avoid port/state conflicts
    fileParallelism: false,
  },
});
