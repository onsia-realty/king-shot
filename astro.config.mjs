// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

/**
 * canonical / OG / sitemap 에 쓰이는 사이트 주소.
 * 1) SITE_URL 환경변수가 있으면 그걸 쓴다 (커스텀 도메인 붙일 때 여기에 넣으면 된다)
 * 2) Vercel 빌드에서는 프로덕션 도메인이 자동으로 들어온다
 * 3) 로컬 빌드는 localhost 로 떨어진다
 */
const SITE =
  process.env.SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:4321');

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
