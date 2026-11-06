import type { IncomingMessage, ServerResponse } from 'node:http';
import { allowRequest } from '../src/lib/server/same-site.js';
import { lookupWebPlayer, playerId, type PublicPlayer } from '../src/lib/server/web-player.js';

const TTL = 5 * 60 * 1000;
const WEB_TTL = 60_000;
const LIMIT = 100;
const TIMEOUT = 95_000;
type CacheEntry = { data: PublicPlayer; storedAt: number; generation: number; refreshed?: boolean };
const cache = new Map<string, CacheEntry>();
const pending = new Map<string, Promise<PublicPlayer>>();
let generation = 0;
let refreshRevision = 0;
const lifetime = (data: PublicPlayer) => data.source === 'web' ? WEB_TTL : TTL;
const errors = {
  missing_key: [503, '플레이어 조회 서비스가 아직 설정되지 않았습니다.'],
  invalid_id: [400, '게임 내 영주 ID를 1~15자리 양의 정수로 입력해 주세요.'],
  invalid_id_type: [400, 'ID 유형은 governor_id 또는 uid만 지원합니다.'],
  invalid_refresh: [400, '갱신 옵션은 refresh=1만 지원합니다.'],
  invalid_method: [405, 'GET 요청만 지원합니다.'],
  not_found: [404, '해당 영주 ID의 플레이어를 찾을 수 없습니다.'],
  upstream_auth: [502, '플레이어 조회 서비스 인증에 문제가 있습니다.'],
  rate_limited: [429, '조회 요청이 많습니다. 잠시 후 다시 시도해 주세요.'],
  timeout: [504, '플레이어 조회 시간이 초과되었습니다. 다시 시도해 주세요.'],
  upstream_error: [502, '플레이어 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'],
} as const;
type ErrorCode = keyof typeof errors;
class LookupError extends Error {
  constructor(public code: ErrorCode) { super(code); }
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function sendError(res: ServerResponse, code: ErrorCode) {
  res.statusCode = errors[code][0];
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify({ ok: false, error: code, message: errors[code][1] }));
}

async function lookupOfficial(id: string, key: string, idType: 'uid' | 'governor_id'): Promise<PublicPlayer> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new LookupError('timeout'));
    }, TIMEOUT);
  });
  try {
    return await Promise.race([expired, (async (): Promise<PublicPlayer> => {
      const response = await fetch(
        `https://api.mightpulse.com/v1/players/${id}?include=base,heroes,ranks,gov_gear${idType === 'uid' ? '&id_type=uid' : ''}`,
        // Cloudflare answers anonymous library user agents with 403 (code 1010); this UA is verified to pass.
        { headers: { Authorization: `Bearer ${key}`, 'User-Agent': 'kingshot-gongryak-site/1.0 (+https://xn--ob0bx7rdoh9mq.xyz)', Accept: 'application/json' },
          signal: controller.signal, redirect: 'error' },
      );
      if (!response.ok) {
        // Never parse, forward or log provider error bodies.
        const code = response.status === 404 ? 'not_found'
          : response.status === 401 || response.status === 403 ? 'upstream_auth'
          : response.status === 429 ? 'rate_limited' : 'upstream_error';
        throw new LookupError(code);
      }
      const data: unknown = await response.json();
      if (!object(data) || data.ok !== true || !object(data.player)
        || !Array.isArray(data.heroes) || !object(data.ranks) || !object(data.gov_gear)
        || playerId(data[idType]) !== id) {
        throw new LookupError('upstream_error');
      }
      // Sections are top-level provider fields, including hidden governor gear.
      return {
        ok: true, uid: data.uid ?? null, governor_id: data.governor_id ?? null,
        player: data.player, heroes: data.heroes, ranks: data.ranks,
        gov_gear: data.gov_gear.hidden === true
          ? { ...data.gov_gear, items: [], message: '영주 장비가 비공개로 설정되어 있습니다.' }
          : data.gov_gear,
        fresh: data.fresh ?? null, cached_at: data.cached_at ?? null,
        age_seconds: typeof data.age_seconds === 'number' && Number.isFinite(data.age_seconds)
          && data.age_seconds >= 0 ? data.age_seconds : null,
        source: 'official',
      };
    })()]);
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!allowRequest(req, res)) return;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendError(res, 'invalid_method');
  }
  let id: string;
  let idType: 'uid' | 'governor_id';
  let refresh: boolean;
  try {
    const params = new URL(req.url ?? '', 'http://localhost').searchParams;
    if (params.has('refresh') && (params.getAll('refresh').length !== 1 || params.get('refresh') !== '1')) {
      return sendError(res, 'invalid_refresh');
    }
    refresh = params.get('refresh') === '1';
    const type = params.get('id_type') ?? 'governor_id';
    if (params.getAll('id_type').length > 1 || (type !== 'uid' && type !== 'governor_id')) {
      return sendError(res, 'invalid_id_type');
    }
    idType = type;
    id = params.get('id') ?? '';
    if (params.getAll('id').length !== 1 || !/^[0-9]{1,15}$/.test(id) || /^0+$/.test(id)) {
      return sendError(res, 'invalid_id');
    }
    id = id.replace(/^0+/, '');
  } catch {
    return sendError(res, 'invalid_id');
  }
  const cacheKey = `${idType}:${id}`;
  try {
    const now = Date.now();
    for (const [entryId, entry] of cache) {
      if (now - entry.storedAt >= lifetime(entry.data)) cache.delete(entryId);
    }
    let entry = refresh ? undefined : cache.get(cacheKey);
    if (!entry) {
      const pendingKey = refresh ? `refresh:${cacheKey}` : cacheKey;
      let work = pending.get(pendingKey);
      if (!work) {
        if (pending.size >= LIMIT) return sendError(res, 'rate_limited');
        const started = ++generation;
        const revision = refreshRevision;
        work = (async () => {
          if (!refresh) {
            const web = await lookupWebPlayer(id, idType);
            if (web) return web;
          }
          // Public web requests never need or receive the official key.
          const key = process.env.MIGHTPULSE_API_KEY?.trim();
          if (!key) throw new LookupError('missing_key');
          return lookupOfficial(id, key, idType);
        })().then(data => {
          if (refresh) refreshRevision++;
          // A completed manual refresh wins over ordinary work that was already in flight.
          if (!refresh && revision !== refreshRevision) return data;
          const saved = { data, storedAt: Date.now(), generation: started, refreshed: refresh };
          const aliases = new Set([cacheKey]);
          for (const type of ['uid', 'governor_id'] as const) {
            const identity = playerId(data[type]);
            if (identity) aliases.add(`${type}:${identity}`);
          }
          for (const alias of aliases) {
            const previous = cache.get(alias);
            if (previous && previous.generation > started && (!refresh || previous.refreshed)) continue;
            cache.delete(alias);
            if (cache.size >= LIMIT) cache.delete(cache.keys().next().value!);
            cache.set(alias, saved);
          }
          return data;
        }).finally(() => { pending.delete(pendingKey); });
        pending.set(pendingKey, work);
      }
      const data = await work;
      // An entry may be evicted while another request awaits this result.
      const saved = cache.get(cacheKey);
      entry = saved?.data === data ? saved : { data, storedAt: Date.now(), generation: 0 };
    }
    const elapsed = Math.max(0, Date.now() - entry.storedAt);
    const secondsLeft = Math.max(0, Math.floor((lifetime(entry.data) - elapsed) / 1000));
    res.statusCode = 200;
    res.setHeader('Cache-Control', refresh ? 'no-store' : `public, max-age=0, s-maxage=${secondsLeft}`);
    res.end(JSON.stringify({
      ...entry.data,
      age_seconds: entry.data.age_seconds === null ? null
        : entry.data.age_seconds + Math.floor(elapsed / 1000),
    }));
  } catch (error) {
    sendError(res, error instanceof LookupError ? error.code : 'upstream_error');
  }
}
