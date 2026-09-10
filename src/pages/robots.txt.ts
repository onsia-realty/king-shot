import type { APIContext } from 'astro';

/**
 * robots.txt 를 정적 파일 대신 엔드포인트로 뽑는다.
 * Sitemap 주소가 astro.config 의 site(배포 도메인)를 따라가게 하려는 목적.
 */
export function GET(context: APIContext) {
  const sitemap = new URL('sitemap-index.xml', context.site).href;

  const body = `User-agent: *
Allow: /

# 네이버
User-agent: Yeti
Allow: /

Sitemap: ${sitemap}
`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
