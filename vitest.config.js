// vitest.config.js — Phase 4 update: bổ sung coverage + test paths mới
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    isolate: true,
    include: [
      'tests/**/*.test.js',
      'tests/unit/**/*.test.js',
      'tests/integration/**/*.test.js',
      'tests/smoke/**/*.test.js',
    ],
    exclude: [
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
        'commands/test_bot.js',
        'handlers/testBotHandler.js',
      ],
      thresholds: {
        lines:      60,
        functions:  60,
        branches:   55,
        statements: 60,
      },
    },
    testTimeout: 10_000,
  },
});
