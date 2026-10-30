import type { IncomingMessage, ServerResponse } from 'node:http';
import { allowRequest } from '../src/lib/server/same-site.js';
import { createOfficialMapService, OfficialMapError, parseMapQuery } from '../src/lib/server/official-map.js';
import { saveAlliancePositions } from '../src/lib/server/save-alliance-map.js';

const service = createOfficialMapService();
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!allowRequest(req, res)) return;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  const send = (status: number, data: unknown) => { res.statusCode = status; res.end(JSON.stringify(data)); };
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return send(405, { ok: false, error: 'invalid_method', message: 'GET 요청만 지원합니다.' });
  }
  try {
    const query = parseMapQuery(new URL(req.url ?? '', 'http://localhost').searchParams);
    const result = await service(query);
    if (result.kind === 'positions') {
      const stored = Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL) && await saveAlliancePositions(result);
      return send(200, { ...result, stored });
    }
    return send(200, result);
  } catch (error) {
    const safe = error instanceof OfficialMapError ? error : new OfficialMapError('upstream_error');
    if (safe.retryAfter !== undefined) res.setHeader('Retry-After', String(safe.retryAfter));
    return send(safe.status, { ok: false, error: safe.code,
      message: safe.status === 400 ? '왕국, 연맹 태그 또는 조회 위치를 확인해 주세요.'
        : safe.status === 429 ? '조회 요청이 많습니다. 잠시 후 다시 시도해 주세요.'
          : safe.status === 503 ? '공식 API 연결을 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.'
            : '연맹 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
      ...(safe.retryAfter === undefined ? {} : { retryAfter: safe.retryAfter }) });
  }
}
