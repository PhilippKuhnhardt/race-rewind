import sitemap from '@astrojs/sitemap';
import svelte from '@astrojs/svelte';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, memoryCache } from 'astro/config';
import { SITE_URL } from './src/lib/const.ts';

import node from '@astrojs/node';

export default defineConfig({
  site: SITE_URL,
  trailingSlash: 'always',
  build: { format: 'directory' },
  // Cloudflare remains the outer shared cache. This origin cache protects the
  // Node server when a response is not present at the edge.
  cache: {
    provider: memoryCache(),
  },
  integrations: [
    sitemap({
      filter: (page) => {
        const pathname = page.startsWith(SITE_URL) ? page.slice(SITE_URL.length) : page;
        return (
          !pathname.startsWith('/drivers/') &&
          !pathname.startsWith('/teams/') &&
          !pathname.startsWith('/compare/') &&
          !pathname.startsWith('/legal/') &&
          pathname !== '/stats/'
        );
      },
    }),
    svelte(),
  ],

  vite: {
    plugins: [tailwindcss()],
    server: {
      watch: {
        ignored: [
          '**/.astro/**',
          '**/.opencode/**',
          '**/.venv/**',
          '**/content/**',
          '**/dist/**',
          '**/node_modules/**',
        ],
      },
    },
  },

  adapter: node({
    mode: 'standalone',
  }),
});
