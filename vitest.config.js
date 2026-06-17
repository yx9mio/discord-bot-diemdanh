'use strict';
const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.{js,mjs}'],
    coverage: {
      provider: 'v8',
      include: ['services/**', 'utils/**'],
    },
  },
  server: {
    deps: {
      inline: [
        /services\/.*\.js$/,
        /utils\/.*\.js$/,
      ],
    },
  },
  deps: {
    inline: [
      /services\/.*\.js$/,
      /utils\/.*\.js$/,
    ],
  },
});
