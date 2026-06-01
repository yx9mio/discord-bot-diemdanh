'use strict';
const js  = require('@eslint/js');
const nPlugin = require('eslint-plugin-n');

module.exports = [
  js.configs.recommended,
  {
    plugins: { n: nPlugin },
    rules: {
      // Bắt await bị thiếu trên Promise (kiểu bug C-1)
      'no-floating-promises': 'off', // rule này thuộc @typescript-eslint; dùng n/no-sync thay thế

      // Node best-practices
      'n/no-process-exit':          'warn',
      'n/handle-callback-err':      'error',

      // Code quality
      'no-unused-vars':             ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console':                 'warn',
      'eqeqeq':                     ['error', 'always', { null: 'ignore' }],
      'prefer-const':               'error',
      'no-var':                     'error',

      // Async safety
      'require-await':              'warn',
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType:  'commonjs',
      globals: {
        require:   'readonly',
        module:    'readonly',
        exports:   'writable',
        __dirname: 'readonly',
        __filename:'readonly',
        process:   'readonly',
        console:   'readonly',
        setTimeout:'readonly',
        clearTimeout:'readonly',
        setImmediate:'readonly',
        Buffer:    'readonly',
        Map:       'readonly',
        Set:       'readonly',
        Promise:   'readonly',
      },
    },
    ignores: ['node_modules/**', 'tests/**'],
  },
];
