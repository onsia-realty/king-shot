// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// TODO: 배포 후 실제 도메인으로 교체할 것 (canonical / OG / sitemap 에 사용됨)
const SITE = 'https://example.com';

export default defineConfig({
  site: SITE,
  // output: 'static' (기본값) — Vercel 어댑터 미사용
  integrations: [sitemap(), react()],
  vite: {
    plugins: [tailwindcss()],
  },
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
    },
  },
});
