import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      react.configs.flat.recommended,
      react.configs.flat['jsx-runtime'],
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['**/components/scene/**/*.{js,jsx}'],
    rules: {
      // R3F uses Three.js / fiber props that are not DOM attributes
      'react/no-unknown-property': 'off',
    },
  },
  {
    files: ['**/components/landing/**/*.{js,jsx}'],
    rules: {
      'react/no-unknown-property': 'off',
      'react/prop-types': 'off',
    },
  },
  {
    files: ['**/components/ui/ThemeToggle.jsx', '**/components/ui/ThemeSync.jsx'],
    rules: { 'react/prop-types': 'off' },
  },
  {
    files: ['vite.config.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
])
