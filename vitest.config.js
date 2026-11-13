import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: { url: 'http://localhost:3000' }
    },
    globals: true,
    setupFiles: ['./tests/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', 'tests/e2e/'],
    },
    exclude: ['node_modules/', 'dist/', 'tests/e2e/'],
  },
});
