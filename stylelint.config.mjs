export default {
  extends: ['stylelint-config-standard-scss', 'stylelint-config-clean-order'],
  ignoreFiles: ['.angular/**', 'coverage/**', 'dist/**', 'node_modules/**', 'out-tsc/**'],
  rules: {
    'alpha-value-notation': 'number',
    'color-function-notation': 'modern',
    'custom-property-pattern': null,
    'declaration-empty-line-before': null,
    'no-descending-specificity': null,
    'selector-class-pattern': null,
    'scss/at-extend-no-missing-placeholder': null,
    'scss/dollar-variable-pattern': null
  }
};
