import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/unit/**/*.test.ts', 'test/property/**/*.test.ts'],
    environment: 'node',
    testTimeout: 60000,
  },
});
