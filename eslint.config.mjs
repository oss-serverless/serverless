import js from '@eslint/js';
import globals from 'globals';
import { flatConfigs as importXFlatConfigs } from 'eslint-plugin-import-x';
import n from 'eslint-plugin-n';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import { defineConfig, globalIgnores } from 'eslint/config';

const devDependencyFiles = [
  '**/*.test.js',
  '**/scripts/**',
  '**/test/**',
  '**/tests/**',
  'eslint.config.mjs',
  'prettier.config.js',
];

export default defineConfig([
  {
    name: 'osls/linter-options',
    linterOptions: {
      reportUnusedDisableDirectives: 'warn',
    },
  },
  globalIgnores(['**/.*', '!.github/', '!.github/**']),
  js.configs.recommended,
  n.configs['flat/recommended-script'],
  importXFlatConfigs.recommended,
  eslintConfigPrettier,
  {
    name: 'osls/javascript',
    files: ['**/*.{cjs,js,mjs}'],
    languageOptions: {
      ecmaVersion: 2025,
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
      'n/no-extraneous-import': 'off',
      'n/no-unsupported-features/node-builtins': ['error', { allowExperimental: true }],
      'n/no-extraneous-require': 'off',
      'n/no-missing-import': 'off',
      'n/no-unpublished-import': 'off',
      'n/no-unpublished-require': 'off',
      'n/no-missing-require': 'off',
      'n/no-process-exit': 'off',
      'n/no-deprecated-api': 'off',
      'n/hashbang': 'off',
      'n/no-unpublished-bin': 'error',
    },
  },
  {
    name: 'osls/published-files',
    files: ['bin/serverless.js', 'commands/**/*.js', 'lib/**/*.js', 'scripts/serverless.js'],
    rules: {
      'n/no-unpublished-import': 'error',
      'n/no-unpublished-require': 'error',
    },
  },
  {
    name: 'osls/modules',
    files: ['**/*.mjs'],
    languageOptions: {
      sourceType: 'module',
    },
  },
  {
    name: 'osls/tests',
    files: ['**/*.test.js', '**/test/**'],
    languageOptions: {
      globals: globals.mocha,
    },
    rules: {
      'no-unused-expressions': 'off',
    },
  },
  {
    name: 'osls/lambda-fixtures',
    files: ['test/fixtures/**'],
    languageOptions: {
      globals: {
        awslambda: 'readonly',
      },
    },
  },
  {
    name: 'osls/esm-fixtures',
    files: [
      'test/fixtures/programmatic/plugin/local-esm-plugin/**',
      'test/fixtures/programmatic/plugin/node_modules/esm-plugin/**',
      'test/fixtures/programmatic/invocation/esm/**',
    ],
    languageOptions: {
      sourceType: 'module',
    },
  },
]);
