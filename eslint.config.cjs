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
        require:       'readonly',
        module:        'readonly',
        exports:       'writable',
        __dirname:     'readonly',
        __filename:    'readonly',
        process:       'readonly',
        console:       'readonly',
        setTimeout:    'readonly',
        clearTimeout:  'readonly',
        setInterval:   'readonly',
        clearInterval: 'readonly',
        setImmediate:  'readonly',
        Buffer:        'readonly',
        Map:           'readonly',
        Set:           'readonly',
        Promise:       'readonly',
        URL:           'readonly',
        URLSearchParams: 'readonly',
      },
    },
    ignores: ['node_modules/**'],
  },

  // ── Override cho tests/ CJS (commands.test.js, v.v.) ──────────────────────
  {
    files: ['tests/*.js', 'tests/**/*.js'],
    ignores: ['tests/unit/**', 'tests/validate.test.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType:  'commonjs',
      globals: {
        require:       'readonly',
        module:        'readonly',
        exports:       'writable',
        __dirname:     'readonly',
        __filename:    'readonly',
        process:       'readonly',
        console:       'readonly',
        setTimeout:    'readonly',
        clearTimeout:  'readonly',
        setInterval:   'readonly',
        clearInterval: 'readonly',
        Buffer:        'readonly',
        Map:           'readonly',
        Set:           'readonly',
        Promise:       'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console':     'off',
      'require-await':  'off',
    },
  },

  // ── Override cho tests/unit/ và tests/validate.test.js (ESM / Vitest) ─────
  {
    files: ['tests/unit/**/*.js', 'tests/unit/**/*.ts', 'tests/validate.test.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType:  'module',
      globals: {
        process:   'readonly',
        console:   'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console':     'off',
      'require-await':  'off',
    },
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
