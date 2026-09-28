import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import rehypeGallery from './scripts/rehype-gallery.mjs';

export default defineConfig({
  site: 'https://pessimist11.pages.dev',
  trailingSlash: 'always',
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/404'),
    }),
  ],
  markdown: {
    rehypePlugins: [rehypeGallery],
  },
});
