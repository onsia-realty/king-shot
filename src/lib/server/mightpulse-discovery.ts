import type { IncomingMessage, ServerResponse } from 'node:http';

const errors = {
  invalid_method: [405, 'GET 요청만 지원합니다.'],
  invalid_query: [400, '검색어를 2~80자로 입력해 주세요.'],
  invalid_kid: [400, '왕국 번호를 1~10000 사이의 정수로 입력해 주세요.'],
  rate_limited: [429, '조회 요청이 많습니다. 잠시 후 다시 시도해 주세요.'],
  timeout: [504, '조회 시간이 초과되었습니다. 다시 시도해 주세요.'],
  upstream_error: [502, '정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'],
} as const;
type ErrorCode = keyof typeof errors;
export class DiscoveryError extends Error {
  constructor(public code: ErrorCode) { super(code); }
}
export function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function number(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
export function text(value: unknown): string | null {
  return typeof value === 'string' ? value.slice(0, 2048) : null;
}
export function id(value: unknown): number | string | null {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return value;
  if (typeof value === 'string' && /^[0-9]{1,15}$/.test(value) && !/^0+$/.test(value)) {
    return value.replace(/^0+/, '');
  }
  return null;
}
export function kingdom(params: URLSearchParams, optional = false): number | null {
  if (optional && !params.has('kid')) return null;
  const value = params.get('kid') ?? '';
  if (params.getAll('kid').length !== 1 || !/^[0-9]{1,5}$/.test(value)
    || Number(value) < 1 || Number(value) > 10000) throw new DiscoveryError('invalid_kid');
  return Number(value);
}
function sendError(res: ServerResponse, code: ErrorCode) {
  res.statusCode = errors[code][0];
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify({ ok: false, error: code, message: errors[code][1] }));
}
async function fetchData(url: string): Promise<unknown> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new DiscoveryError('timeout'));
    }, 30_000);
  });
  try {
    return await Promise.race([expired, (async () => {
      // Public website endpoints never receive the official API credential.
      const response = await fetch(url, { signal: controller.signal, redirect: 'error' });
      if (!response.ok) throw new DiscoveryError(response.status === 429 ? 'rate_limited' : 'upstream_error');
      return await response.json();
    })()]);
  } finally { clearTimeout(timer); }
}

export function discoveryHandler<P, D>(options: {
  ttl: number;
  limit: number;
  parse: (params: URLSearchParams) => P;
  key: (params: P) => string;
  url: (params: P) => string;
  normalize: (data: unknown, params: P) => D;
  present?: (data: D, params: P) => D;
  fresh?: (params: URLSearchParams) => boolean;
}) {
  const cache = new Map<string, { data: D; storedAt: number }>();
  const pending = new Map<string, Promise<D>>();
  return async (req: IncomingMessage, res: ServerResponse) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return sendError(res, 'invalid_method');
    }
    try {
      const query = new URL(req.url ?? '', 'http://localhost').searchParams;
      const params = options.parse(query);
      const fresh = options.fresh?.(query) ?? false;
      const baseKey = options.key(params);
      const key = fresh ? `${baseKey}:fresh` : baseKey;
      const ttl = fresh ? 5_000 : options.ttl;
      const now = Date.now();
      for (const [key, entry] of cache) if (now - entry.storedAt >= options.ttl) cache.delete(key);
      let entry = cache.get(key);
      if (entry && now - entry.storedAt >= ttl) { cache.delete(key); entry = undefined; }
      if (!entry) {
        let work = pending.get(key);
        if (!work) {
          if (pending.size >= options.limit) return sendError(res, 'rate_limited');
          const startedAt = Date.now();
          work = fetchData(options.url(params)).then(raw => {
            // An older ordinary fetch must not overwrite a refresh that finished meanwhile.
            const refreshed = !fresh && options.fresh ? cache.get(`${baseKey}:fresh`) : undefined;
            if (refreshed && (refreshed.storedAt >= startedAt || Date.now() - refreshed.storedAt < 5_000)) return refreshed.data;
            const data = options.normalize(raw, params);
            if (cache.size >= options.limit) cache.delete(cache.keys().next().value!);
            cache.set(key, { data, storedAt: Date.now() });
            if (fresh) cache.delete(baseKey);
            return data;
          }).finally(() => { pending.delete(key); });
          pending.set(key, work);
        }
        const data = await work;
        entry = cache.get(key) ?? { data, storedAt: Date.now() };
      }
      const secondsLeft = Math.max(0, Math.floor((options.ttl - Math.max(0, Date.now() - entry.storedAt)) / 1000));
      res.statusCode = 200;
      res.setHeader('Cache-Control', fresh ? 'no-store' : `public, max-age=0, s-maxage=${secondsLeft}`);
      res.end(JSON.stringify(options.present ? options.present(entry.data, params) : entry.data));
    } catch (error) {
      sendError(res, error instanceof DiscoveryError ? error.code : 'upstream_error');
    }
  };
}
