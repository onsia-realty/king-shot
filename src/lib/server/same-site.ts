import type { IncomingMessage, ServerResponse } from 'node:http';

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;
const MAX_IPS = 5000;
// ponytail: 함수 인스턴스별 메모리 카운터라 인스턴스·엔드포인트(api/*.ts)마다 따로 센다.
// 실제 남용이 보이면 Vercel WAF rate-limit 규칙이나 DB/KV 카운터로 올린다.
const hits = new Map<string, { start: number; count: number }>();

function deny(res: ServerResponse, status: number, error: string, message: string) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify({ ok: false, error, message }));
  return false;
}

/**
 * 같은 사이트 화면에서 온 요청만 통과시키고 IP당 분당 요청 수를 제한한다.
 * 거부하면 응답을 직접 보내고 false 를 돌려준다. 핸들러 맨 위에서 `if (!allowRequest(req, res)) return;`
 */
export function allowRequest(req: IncomingMessage, res: ServerResponse): boolean {
  const header = (name: string) => {
    const value = req.headers?.[name];
    return (Array.isArray(value) ? value[0] : value) ?? '';
  };
  // 응답이 Sec-Fetch-Site 에 따라 달라지므로 CDN 캐시 키에 넣는다. 브라우저가 직접 붙이는 값이라
  // 정상 방문자는 항상 same-origin 하나로 모이고, 다른 사이트(cross-site)나 헤더 없는 호출은 캐시를 못 맞춘다.
  // Referer 는 페이지·쿼리마다 달라 캐시가 잘게 쪼개지므로 Vary 에 넣지 않는다.
  res.setHeader('Vary', 'Sec-Fetch-Site');
  if (header('sec-fetch-site') !== 'same-origin') {
    // Sec-Fetch-Site 가 없는 구형 브라우저: Origin(없으면 Referer)의 호스트가 요청 Host 와 같아야 한다.
    const host = header('host').toLowerCase();
    let same = false;
    try { same = host !== '' && new URL(header('origin') || header('referer')).host.toLowerCase() === host; } catch { /* 형식이 틀리면 거부 */ }
    if (!same) return deny(res, 403, 'forbidden', '이 사이트 화면에서만 사용할 수 있는 요청입니다.');
    // 이 경로로 통과한 응답은 Vary 로 구분되지 않으므로 Vercel CDN 에는 저장하지 않는다(브라우저 헤더는 그대로).
    res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  }
  const ip = header('x-real-ip').trim() || header('x-forwarded-for').split(',')[0].trim();
  if (!ip) return true;
  const now = Date.now();
  let hit = hits.get(ip);
  if (!hit || now - hit.start >= WINDOW_MS) {
    // 지우고 다시 넣어 Map 순서를 윈도 시작 순서로 유지한다. 가득 차면 가장 오래된 IP 부터 버린다.
    hits.delete(ip);
    if (hits.size >= MAX_IPS) hits.delete(hits.keys().next().value!);
    hits.set(ip, hit = { start: now, count: 0 });
  }
  if (++hit.count <= MAX_REQUESTS) return true;
  res.setHeader('Retry-After', String(Math.max(1, Math.ceil((hit.start + WINDOW_MS - now) / 1000))));
  return deny(res, 429, 'rate_limited', '조회 요청이 많습니다. 잠시 후 다시 시도해 주세요.');
}
