// @ts-check
const eslint = require('@eslint/js');
const angular = require('angular-eslint');
const eslintConfigPrettier = require('eslint-config-prettier');
const globals = require('globals');
const tseslint = require('typescript-eslint');

module.exports = tseslint.config(
  {
    ignores: ['.angular/**', 'coverage/**', 'dist/**', 'node_modules/**', 'out-tsc/**']
  },
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
      ...angular.configs.tsRecommended,
      eslintConfigPrettier
    ],
    processor: angular.processInlineTemplates,
    languageOptions: {
      globals: {
        ...globals.browser
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname
      }
    },
    rules: {
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case'
        }
      ],
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase'
        }
      ],
      '@angular-eslint/prefer-inject': 'error',
      '@angular-eslint/prefer-on-push-component-change-detection': 'error',
      '@angular-eslint/prefer-signals': 'warn',
      '@angular-eslint/prefer-standalone': 'error',
      '@angular-eslint/sort-lifecycle-methods': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          fixStyle: 'inline-type-imports'
        }
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-inferrable-types': 'off',
      '@typescript-eslint/no-misused-promises': [
        'error',
        {
          checksVoidReturn: {
            attributes: false
          }
        }
      ],
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          varsIgnorePattern: '^_'
        }
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }]
    }
  },
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
    rules: {
      '@angular-eslint/template/attributes-order': 'warn',
      '@angular-eslint/template/button-has-type': 'error',
      '@angular-eslint/template/eqeqeq': 'error',
      '@angular-eslint/template/no-duplicate-attributes': 'error',
      '@angular-eslint/template/no-inline-styles': 'error',
      '@angular-eslint/template/prefer-control-flow': 'error',
      '@angular-eslint/template/prefer-self-closing-tags': 'error'
    }
  }
);
