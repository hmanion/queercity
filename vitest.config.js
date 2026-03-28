import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.js'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'dom',
          include: ['tests/dom/**/*.test.js'],
          environment: 'jsdom',
        },
      },
    ],
  },
});
