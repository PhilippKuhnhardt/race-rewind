import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import svelte from '@astrojs/svelte';
import tailwindcss from '@tailwindcss/vite';
import { SITE_URL } from './src/lib/const.ts';

export default defineConfig({
  site: SITE_URL,
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [sitemap(), svelte()],
  vite: {
    plugins: [tailwindcss()],
    server: { watch: { ignored: ['**/content/**', '**/.venv/**'] } },
  },
});
