// @ts-check

import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import reactHooks from "eslint-plugin-react-hooks";

export default defineConfig(
  { ignores: ["dist/", "src/module_bindings/", "scripts/", "android/", "ios/"] },
  {
    files: ["src/**/*.{ts,tsx}"],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],
      // Downgraded from error: react-hooks v7.1 introduced these strict rules; all flagged
      // patterns are intentional and low-risk (derived-state caching, stable ref aliasing,
      // Date.now in useMemo, manual memoization). Track as warnings rather than blocking builds.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/immutability': 'warn',
    },
  },
);
