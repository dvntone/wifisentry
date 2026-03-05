module.exports = {
  env: {
    node: true,
    commonjs: true,
    es2021: true,
    jest: true,
    mocha: true,
  },
  extends: 'eslint:recommended',
  parserOptions: {
    ecmaVersion: 12,
  },
  ignorePatterns: [
    'node_modules/',
    'web-app/',
    'public/_next/',
    'android-native/',
    'dist/',
    'out/',
  ],
  rules: {
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-console': 'off',
    'semi': ['error', 'always'],
    'quotes': ['error', 'single'],
  },
};
