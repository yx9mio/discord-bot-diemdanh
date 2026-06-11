'use strict';
const js = require('@eslint/js');

module.exports = [
  {
    ignores: ['node_modules/**', 'dist/**', 'data/**', '.github/**', 'coverage/**'],
  },
  js.configs.recommended,

  // ── Base config cho tất cả file CJS ──────────────────────────────────────────
  {
    plugins: {},
    rules: {
      'no-unused-vars': ['warn', {
        argsIgnorePattern:         '^_',
        varsIgnorePattern:         '^_',
        caughtErrorsIgnorePattern: '^_',
        caughtErrors:              'all',
      }],
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
        require:         'readonly',
        module:          'readonly',
        exports:         'writable',
        __dirname:       'readonly',
        __filename:      'readonly',
        process:         'readonly',
        console:         'readonly',
        setTimeout:      'readonly',
        clearTimeout:    'readonly',
        setInterval:     'readonly',
        clearInterval:   'readonly',
        setImmediate:    'readonly',
        Buffer:          'readonly',
        Map:             'readonly',
        Set:             'readonly',
        Promise:         'readonly',
        URL:             'readonly',
        URLSearchParams: 'readonly',
      },
    },
  },

  // ── Override cho tests/ CJS (các file không phải ESM) ────────────────────────
  {
    files:   ['tests/*.js', 'tests/**/*.js'],
    ignores: [
      'tests/unit/**',
      'tests/utils.test.js',
      'tests/validate.test.js',
      'tests/commands.test.js',
      'tests/embeds.test.js',
      'tests/handlers.test.js',
      'tests/scheduler.test.js',
      'tests/session.test.js',
      'tests/timeCalc.test.js',
      'tests/integration/**',
      'tests/smoke/**',
    ],
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
      'no-unused-vars': ['warn', {
        argsIgnorePattern:         '^_',
        varsIgnorePattern:         '^_',
        caughtErrorsIgnorePattern: '^_',
        caughtErrors:              'all',
      }],
      'no-console':    'off',
      'require-await': 'off',
    },
  },

  // ── Override cho ESM test files (Vitest) ──────────────────────────────────────
  {
    files: [
      'tests/utils.test.js',
      'tests/commands.test.js',
      'tests/handlers.test.js',
      'tests/unit/**/*.js',
      'tests/unit/**/*.ts',
      'tests/validate.test.js',
      'tests/embeds.test.js',
      'tests/scheduler.test.js',
      'tests/session.test.js',
      'tests/timeCalc.test.js',
      'tests/integration/**/*.js',
      'tests/smoke/**/*.js',
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType:  'module',
      globals: {
        process: 'readonly',
        console: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', {
        argsIgnorePattern:         '^_',
        varsIgnorePattern:         '^_',
        caughtErrorsIgnorePattern: '^_',
        caughtErrors:              'all',
      }],
      'no-console':    'off',
      'require-await': 'off',
    },
  },

  // ── Override cho file ESM (vitest.config.js, *.mjs) ───────────────────────────
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
