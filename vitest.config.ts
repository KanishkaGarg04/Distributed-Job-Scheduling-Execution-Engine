import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['dist/**', 'node_modules/**'],
    env: { DATABASE_URL: 'postgresql://test:test@127.0.0.1:5432/test' },
  },
});
