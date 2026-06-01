'use strict';
const js       = require('@eslint/js');
const nPlugin  = require('eslint-plugin-n');

module.exports = [
  js.configs.recommended,

  // ── Base config cho tất cả file CJS ────────────────────────────────────────
  {
    plugins: { n: nPlugin },
    rules: {
      'n/no-process-exit':     'warn',
      'n/handle-callback-err': 'error',

      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console':     'warn',
      'eqeqeq':         ['error', 'always', { null: 'ignore' }],
      'prefer-const':   'error',
      'no-var':         'error',
      'require-await':  'warn',
      'no-empty':       ['error', { allowEmptyCatch: true }],
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType:  'commonjs',
      globals: {
        require:      'readonly',
        module:       'readonly',
        exports:      'writable',
        __dirname:    'readonly',
        __filename:   'readonly',
        process:      'readonly',
        console:      'readonly',
        setTimeout:   'readonly',
        clearTimeout: 'readonly',
        setImmediate: 'readonly',
        Buffer:       'readonly',
        Map:          'readonly',
        Set:          'readonly',
        Promise:      'readonly',
      },
    },
    ignores: ['node_modules/**', 'tests/**'],
  },

  // ── Override cho file ESM (vitest.config.js, *.mjs) ────────────────────────
  {
    files: ['vitest.config.js', '*.mjs', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType:  'module',
    },
    rules: {
      'no-unused-vars': 'warn',
    },
  },
];
