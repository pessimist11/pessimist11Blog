import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import rehypeGallery from './scripts/rehype-gallery.mjs';

export default defineConfig({
  site: 'https://pessimist11.pages.dev',
  trailingSlash: 'always',
  integrations: [
    sitemap({
      // /enter/ 是门厅页（已标 noindex），让它只作为入口存在，不进 sitemap
      filter: (page) => !page.includes('/404') && !page.includes('/enter'),
    }),
  ],
  markdown: {
    rehypePlugins: [rehypeGallery],
  },
});
