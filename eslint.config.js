import js from '@eslint/js';
import solid from 'eslint-plugin-solid/configs/typescript';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ...solid,
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ...solid.languageOptions,
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: globals.browser,
    },
  },
  {
    files: ['*.config.{js,ts}', 'vite.config.ts'],
    languageOptions: {
      globals: globals.nodeBuiltin,
    },
  },
);
