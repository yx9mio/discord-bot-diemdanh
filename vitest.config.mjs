// vitest.config.js — CI-safe: unit + smoke mặc định, integration chỉ khi có env
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    isolate: true,
    setupFiles: ['./tests/setup.js'],
    include: [
      'tests/**/*.test.js',
    ],
    exclude: [
      'tests/integration/**',
      'tests/testRunner.js',
      'tests/testConstants.js',
      'node_modules/**',
    ],
    reporters: [
      'verbose',
      ['junit', { outputFile: 'test-results/junit.xml' }],
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'utils/**/*.js',
        'db.js',
        'interaction-handlers/**/*.js',
        'listeners/**/*.js',
        'preconditions/**/*.js',
      ],
      exclude: [
        'node_modules/**',
        'tests/**',
        'migrations/**',
      ],
      thresholds: {
        lines:      60,
        functions:  60,
        branches:   50,
        statements: 60,
      },
    },
    testTimeout: 10_000,
  },
});
