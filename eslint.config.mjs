import eslintJs from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintPluginAstro from 'eslint-plugin-astro';

export default tseslint.config(
  eslintJs.configs.recommended,
  tseslint.configs.recommended,
  ...eslintPluginAstro.configs['flat/recommended'],
  {
    ignores: ['dist/', '.astro/', 'node_modules/', '**/*.d.ts'],
  }
);
