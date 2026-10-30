// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { loadEnv } from 'vite';

/** @returns {import('vite').Plugin} */
function playerApi() {
  return {
    name: 'mightpulse-player-api',
    apply: 'serve',
    configureServer(server) {
      // Load only server-side API variables; never expose a PUBLIC_ key.
      const env = loadEnv(server.config.mode, server.config.root, ['MIGHTPULSE_', 'DATABASE_URL', 'POSTGRES_URL', 'VISITS_']);
      for (const [name, value] of Object.entries(env)) {
        if (process.env[name] === undefined) process.env[name] = value;
      }
      server.middlewares.use(async (req, res, next) => {
        const path = req.url?.split('?')[0];
        const routes = {
          '/api/visits': '/api/visits.ts', '/api/visits/': '/api/visits.ts',
          '/api/player': '/api/player.ts', '/api/player/': '/api/player.ts',
          '/api/search': '/api/search.ts', '/api/search/': '/api/search.ts',
          '/api/map': '/api/map.ts', '/api/map/': '/api/map.ts',
          '/api/alliance-map': '/api/alliance-map.ts', '/api/alliance-map/': '/api/alliance-map.ts',
          '/api/map-refresh': '/api/map-refresh.ts', '/api/map-refresh/': '/api/map-refresh.ts',
        };
        const modulePath = routes[/** @type {keyof typeof routes} */ (path)];
        if (!modulePath) return next();
        try {
          const { default: handler } = await server.ssrLoadModule(modulePath);
          await handler(req, res);
        } catch {
          res.statusCode = 502;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify({ ok: false, error: 'upstream_error', message: '플레이어 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.' }));
        }
      });
    },
  };
}

/**
 * canonical / OG / sitemap 에 쓰이는 사이트 주소.
 * 1) SITE_URL 환경변수가 있으면 그걸 쓴다
 * 2) Vercel 빌드(미리보기 포함)는 대표 도메인 킹샷공략.xyz(퓨니코드 표기)로 고정한다
 * 3) 로컬 빌드는 localhost 로 떨어진다
 */
const SITE =
  process.env.SITE_URL ??
  (process.env.VERCEL ? 'https://xn--ob0bx7rdoh9mq.xyz' : 'http://localhost:4321');

export default defineConfig({
  site: SITE,
  // output: 'static' (기본값) — Vercel 어댑터 미사용
  integrations: [sitemap(), react()],
  vite: {
    plugins: [tailwindcss(), playerApi()],
  },
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
    },
  },
});
