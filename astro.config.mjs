// @ts-check
import { defineConfig } from 'astro/config';
import vue from '@astrojs/vue';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // GitHub Pages user site — deploys at the domain root, so no `base` needed.
  // Used to resolve absolute URLs for OG/social-share tags and canonical links.
  site: 'https://mkociola.github.io',
  integrations: [vue()],
  vite: {
    plugins: [tailwindcss()],
  },
});
