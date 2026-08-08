// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  // Defaults to production, so a local build and the CI job keep emitting
  // exactly the URLs they emit today. The Pages deploy sets SITE_URL to the
  // staging host so that canonical, og:url, sitemap-index.xml and rss.xml all
  // describe the host actually being served — otherwise a reviewer clicking a
  // feed item lands on a domain that is not live yet.
  site: process.env.SITE_URL ?? 'https://kedahfa.com',
  output: 'static',
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
