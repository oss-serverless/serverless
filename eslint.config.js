'use strict';

const js = require('@eslint/js');
const globals = require('globals');
const importX = require('eslint-plugin-import-x');
const n = require('eslint-plugin-n');
const eslintConfigPrettier = require('eslint-config-prettier/flat');

const devDependencyFiles = [
  '**/*.test.js',
  '**/scripts/**',
  '**/test/**',
  '**/tests/**',
  'eslint.config.js',
  'prettier.config.js',
];

module.exports = [
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'warn',
    },
  },
  {
    ignores: ['**/.*', '!.github/', '!.github/**'],
  },
  js.configs.recommended,
  n.configs['flat/recommended-script'],
  importX.flatConfigs.recommended,
  eslintConfigPrettier,
  {
    files: ['**/*.{cjs,js,mjs}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        fetch: 'readonly',
      },
    },
    rules: {
      'import-x/no-extraneous-dependencies': [
        'error',
        {
          devDependencies: devDependencyFiles,
        },
      ],
      'import-x/no-unresolved': ['error', { commonjs: true }],
      'no-unused-vars': [
        'error',
        {
          caughtErrors: 'all',
        },
      ],
      'n/no-unsupported-features/node-builtins': ['error', { allowExperimental: true }],
      'n/no-extraneous-require': 'off',
      'n/no-unpublished-require': 'off',
      'n/no-missing-require': 'off',
      'n/no-process-exit': 'off',
      'n/no-deprecated-api': 'off',
      'n/hashbang': 'off',
    },
  },
  {
    files: ['bin/serverless.js', 'commands/**/*.js', 'lib/**/*.js', 'scripts/serverless.js'],
    rules: {
      'n/no-unpublished-require': 'error',
    },
  },
  {
    files: ['**/*.mjs'],
    languageOptions: {
      sourceType: 'module',
    },
  },
  {
    files: ['**/*.test.js', '**/test/**'],
    languageOptions: {
      globals: globals.mocha,
    },
    rules: {
      'no-unused-expressions': 'off',
    },
  },
  {
    files: ['test/fixtures/**'],
    languageOptions: {
      globals: {
        awslambda: 'readonly',
      },
    },
  },
  {
    files: [
      'test/fixtures/programmatic/plugin/local-esm-plugin/**',
      'test/fixtures/programmatic/plugin/node_modules/esm-plugin/**',
      'test/fixtures/programmatic/invocation/esm/**',
    ],
    languageOptions: {
      sourceType: 'module',
    },
  },
];
