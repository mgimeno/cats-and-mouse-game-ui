export default {
  extends: ['stylelint-config-standard-scss', 'stylelint-config-clean-order'],
  ignoreFiles: [
    '.angular/**',
    'coverage/**',
    'dist/**',
    'node_modules/**',
    'out-tsc/**',
    // Emitted by scripts/generate-material-symbols-font.ts. Lint the generator, not
    // its output: edits here are overwritten on the next run.
    'src/styles/_material-symbols.scss'
  ],
  // Every stylesheet's custom properties, so rules that check custom property usage also know the
  // ones a file uses without declaring them (global tokens, or a parent component's): `color:
  // --primary-colour` (no `var()`) is dropped by the browser without a word, and only
  // `custom-property-no-missing-var-function` catches it.
  referenceFiles: [{ files: ['src/**/*.scss'], customSyntax: 'postcss-scss' }],
  // Every disable comment must say why, still be needed, and name a rule that exists: a rule
  // removed or renamed in a major upgrade would otherwise leave its disables behind silently.
  reportDescriptionlessDisables: true,
  reportInvalidScopeDisables: true,
  reportNeedlessDisables: true,
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
