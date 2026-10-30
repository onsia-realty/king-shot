import type { IncomingMessage, ServerResponse } from 'node:http';
import { allowRequest } from './same-site.js';

const errors = {
  invalid_method: [405, 'GET 요청만 지원합니다.'],
  invalid_query: [400, '검색어를 2~80자로 입력해 주세요.'],
  invalid_kid: [400, '왕국 번호를 1~10000 사이의 정수로 입력해 주세요.'],
  rate_limited: [429, '조회 요청이 많습니다. 잠시 후 다시 시도해 주세요.'],
  timeout: [504, '조회 시간이 초과되었습니다. 다시 시도해 주세요.'],
  upstream_error: [502, '정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'],
  storage_unavailable: [503, '지도 저장소에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.'],
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
export async function fetchData(url: string): Promise<unknown> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new DiscoveryError('timeout'));
    }, 10_000);
  });
  try {
    return await Promise.race([expired, (async () => {
      // Public website endpoints never receive the official API credential.
      const response = await fetch(url, { signal: controller.signal, redirect: 'error', headers: {
        'User-Agent': 'kingshot-gongryak-site/1.0 (+https://xn--ob0bx7rdoh9mq.xyz)', Accept: 'application/json',
      } });
      if (!response.ok) throw new DiscoveryError(response.status === 429 ? 'rate_limited' : 'upstream_error');
      if (!/^application\/(?:json|[\w.-]+\+json)(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '')) {
        throw new DiscoveryError('upstream_error');
      }
      return await response.json();
    })()]);
  } finally { clearTimeout(timer); }
}

// Only validated upstream snapshots enter this bounded cache. Failures retain the last
// good snapshot for at most one hour and cool down for 30s, including fresh requests.
// Fresh and ordinary requests share in-flight work; no retry or upstream rescan occurs.
export function publicSnapshot<K, D>(limit: number, load: (key: K) => Promise<D>) {
  const cache = new Map<K, { data?: D; storedAt: number; retryAt: number }>();
  type Hit = { data: D; stale: boolean; seconds: number } | null;
  const pending = new Map<K, Promise<Hit>>();
  const previous = (entry: { data?: D; storedAt: number } | undefined): Hit =>
    entry?.data !== undefined && Date.now() - entry.storedAt < 3_600_000
      ? { data: entry.data, stale: true, seconds: 0 } : null;
  return async (key: K, fresh = false): Promise<Hit> => {
    const work = pending.get(key);
    if (work) return work;
    const now = Date.now(), entry = cache.get(key);
    if (entry && now < entry.retryAt) return previous(entry);
    if (!fresh && entry?.data !== undefined && entry.retryAt === 0 && now - entry.storedAt < 60_000) {
      return { data: entry.data, stale: false, seconds: Math.floor((60_000 - (now - entry.storedAt)) / 1000) };
    }
    if (pending.size >= limit) throw new DiscoveryError('rate_limited');
    const save = (value: { data?: D; storedAt: number; retryAt: number }) => {
      cache.delete(key);
      if (cache.size >= limit) cache.delete(cache.keys().next().value!);
      cache.set(key, value);
    };
    const request = (async (): Promise<Hit> => {
      try {
        const data = await load(key);
        save({ data, storedAt: Date.now(), retryAt: 0 });
        return { data, stale: false, seconds: 60 };
      } catch {
        const hit = previous(entry);
        save({ data: hit?.data, storedAt: entry?.storedAt ?? 0, retryAt: Date.now() + 30_000 });
        return hit;
      }
    })().finally(() => { pending.delete(key); });
    pending.set(key, request);
    return request;
  };
}

// Handlers that read our own kingdom store: same-site gate, bounded concurrency, JSON errors.
// `run` returns [status, body, cdnSeconds]; anything but a positive cdnSeconds is sent no-store.
export function storeHandler(limit: number,
  run: (params: URLSearchParams, req: IncomingMessage) => Promise<[number, unknown, number?]>, methods = ['GET']) {
  let active = 0;
  return async (req: IncomingMessage, res: ServerResponse) => {
    if (!allowRequest(req, res)) return;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (!methods.includes(req.method ?? '')) {
      res.setHeader('Allow', methods.join(', '));
      return sendError(res, 'invalid_method');
    }
    if (active >= limit) return sendError(res, 'rate_limited');
    active++;
    try {
      const [status, body, seconds = 0] = await run(new URL(req.url ?? '', 'http://localhost').searchParams, req);
      res.statusCode = status;
      res.setHeader('Cache-Control', seconds > 0 ? `public, max-age=0, s-maxage=${seconds}` : 'no-store');
      res.end(JSON.stringify(body));
    } catch (error) {
      sendError(res, error instanceof DiscoveryError ? error.code
        : error instanceof Error && error.message === 'storage_unavailable' ? 'storage_unavailable' : 'upstream_error');
    } finally { active--; }
  };
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
    if (!allowRequest(req, res)) return;
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
