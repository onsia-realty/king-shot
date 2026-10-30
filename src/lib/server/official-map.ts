import type { AllianceMapAlliance, AllianceMapCity, AllianceMapResponse } from '../alliance-map.js';

const TTL = 60 * 60 * 1000;
const UPSTREAM_TIMEOUT = 15_000;
const REQUEST_TIMEOUT = 95_000;
const BATCH_SIZE = 5;
const MAX_ROSTER = 1000;
const tagPattern = /^[\p{L}\p{N}_-]{1,12}$/u;
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const numeric = (v: unknown): number | null => typeof v === 'number' && Number.isFinite(v) ? v : null;
const text = (v: unknown): string | null => typeof v === 'string' ? v.slice(0, 200) : null;

export class OfficialMapError extends Error {
  constructor(public code: string, public status = 502, public retryAfter?: number) { super(code); }
}

export function realUid(value: unknown): string | null {
  if (typeof value === 'number' && (!Number.isSafeInteger(value) || value <= 0)) return null;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const raw = String(value);
  if (!/^\d{1,20}$/.test(raw)) return null;
  const normalized = raw.replace(/^0+/, '');
  return normalized || null;
}

/** Only provider ISO timestamps or Unix seconds. Missing metadata stays unknown. */
export function profileCachedAt(value: unknown): number | null {
  if (typeof value === 'number' || (typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value))) {
    const seconds = Number(value);
    return Number.isFinite(seconds) && seconds >= 0 && seconds <= 253402300799 ? seconds : null;
  }
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const seconds = Date.parse(value) / 1000;
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

export interface OfficialMapQuery { kid: number; tag?: string; offset: number }
export function parseMapQuery(params: URLSearchParams): OfficialMapQuery {
  const kid = params.get('kid') ?? '';
  if (params.getAll('kid').length !== 1 || !/^\d{1,5}$/.test(kid) || +kid < 1 || +kid > 10000) {
    throw new OfficialMapError('invalid_kid', 400);
  }
  const tag = params.get('tag');
  if (params.getAll('tag').length > 1 || (tag !== null && !tagPattern.test(tag))) throw new OfficialMapError('invalid_tag', 400);
  const offset = params.get('offset') ?? '0';
  if (params.getAll('offset').length > 1 || !/^(0|[1-9]\d{0,3})$/.test(offset) || +offset > MAX_ROSTER
    || (tag === null && params.has('offset'))) throw new OfficialMapError('invalid_offset', 400);
  return { kid: +kid, ...(tag === null ? {} : { tag }), offset: +offset };
}

function alliance(raw: unknown): AllianceMapAlliance {
  if (!object(raw)) throw new OfficialMapError('upstream_error');
  const aid = realUid(raw.aid), abbr = text(raw.abbr), name = text(raw.name);
  if (!aid || !abbr || name === null) throw new OfficialMapError('upstream_error');
  const count = numeric(raw.member_count);
  return { aid, abbr, name, member_count: count !== null && Number.isInteger(count) && count >= 0 ? count : null };
}

interface Profile {
  uid: string; kid: number | null; x: number | null; y: number | null;
  nick_name: string | null; power: number | null; tc: number | null;
  aid: string | null; alliance_abbr: string | null; profile_cached_at: number | null;
  cache_ttl_ms: number;
}
function profile(raw: unknown, uid: string): Profile {
  if (!object(raw) || raw.ok !== true || !object(raw.player) || realUid(raw.uid) !== uid
    || realUid(raw.player.uid) !== uid) throw new OfficialMapError('upstream_error');
  const p = raw.player;
  const age = numeric(raw.age_seconds);
  return { uid, kid: numeric(p.kid), x: numeric(p.x), y: numeric(p.y), nick_name: text(p.nick_name),
    power: numeric(p.power), tc: numeric(p.town_center_level),
    aid: object(p.alliance) ? realUid(p.alliance.aid) : null,
    alliance_abbr: object(p.alliance) ? text(p.alliance.abbr) : null,
    profile_cached_at: profileCachedAt(raw.cached_at),
    cache_ttl_ms: age !== null && age >= 0 ? Math.max(30_000, TTL - age * 1000) : TTL };
}

/** Bounded transient caches: evicted on cold start, no cross-instance quota coordination. */
function cache<T>(capacity: number, now: () => number, lifetime: (value: T) => number = () => TTL) {
  const entries = new Map<string, { expires: number; value: T }>();
  const pending = new Map<string, Promise<T>>();
  return async (key: string, load: () => Promise<T>): Promise<T> => {
    const hit = entries.get(key);
    if (hit && hit.expires > now()) return hit.value;
    entries.delete(key);
    const flight = pending.get(key);
    if (flight) return flight;
    const promise = (async () => {
      const value = await load();
      if (entries.size >= capacity) entries.delete(entries.keys().next().value!);
      entries.set(key, { value, expires: now() + lifetime(value) });
      return value;
    })();
    pending.set(key, promise);
    try { return await promise; } finally { pending.delete(key); }
  };
}

interface Dependencies { fetch?: typeof fetch; now?: () => number; key?: () => string | undefined }
export function createOfficialMapService(deps: Dependencies = {}) {
  const now = deps.now ?? Date.now;
  const request = deps.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const key = deps.key ?? (() => process.env.MIGHTPULSE_API_KEY);
  const ranks = cache<AllianceMapAlliance[]>(100, now);
  const rosters = cache<{ alliance: AllianceMapAlliance; members: (string | null)[] }>(200, now);
  const profiles = cache<Profile>(5000, now, value => value.cache_ttl_ms);
  const active = new Map<string, Promise<AllianceMapResponse>>();
  let starts: number[] = [];
  let blockedUntil = 0;
  let quota: { remaining: number; until: number } | undefined;

  function retrySeconds(value: string | null): number | null {
    if (!value) return null;
    const seconds = /^\d+$/.test(value) ? Number(value) : Math.ceil((Date.parse(value) - now()) / 1000);
    return Number.isFinite(seconds) && seconds >= 0 ? Math.max(1, seconds) : null;
  }
  function takeStart() {
    const time = now();
    starts = starts.filter(start => start > time - 60_000);
    if (quota && quota.until <= time) quota = undefined;
    const until = Math.max(blockedUntil, starts.length >= 40 ? starts[0] + 60_000 : 0,
      quota && quota.remaining <= 0 ? quota.until : 0);
    if (until > time) throw new OfficialMapError('rate_limited', 429, Math.max(1, Math.ceil((until - time) / 1000)));
    starts.push(time);
    if (quota) quota.remaining--;
  }
  function quotaHeaders(response: Response) {
    const retry = retrySeconds(response.headers.get('Retry-After'));
    if (response.status === 429) blockedUntil = Math.max(blockedUntil, now() + (retry ?? 60) * 1000);
    const remaining = response.headers.get('X-RateLimit-Remaining') ?? response.headers.get('RateLimit-Remaining');
    if (remaining !== null && /^\d+$/.test(remaining)) {
      const reset = response.headers.get('X-RateLimit-Reset') ?? response.headers.get('RateLimit-Reset');
      const seconds = reset !== null && /^\d+$/.test(reset) ? Number(reset) : NaN;
      // Providers use either epoch seconds or a delta for reset headers.
      const until = Number.isFinite(seconds)
        ? (seconds > 1_000_000_000 ? seconds * 1000 : now() + seconds * 1000)
        : now() + (retry ?? 60) * 1000;
      quota = { remaining: Math.min(Number(remaining), quota && quota.until > now() ? quota.remaining : Infinity),
        until: Math.max(now() + 1000, until, quota?.until ?? 0) };
    }
  }
  async function upstream(path: string, signal: AbortSignal): Promise<unknown> {
    signal.throwIfAborted();
    const token = key()?.trim();
    if (!token) throw new OfficialMapError('missing_key', 503);
    takeStart();
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal.addEventListener('abort', abort, { once: true });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        new Promise<never>((_, reject) => { timer = setTimeout(() => {
          controller.abort(); reject(new OfficialMapError('timeout', 504));
        }, UPSTREAM_TIMEOUT); }),
        (async () => {
          const response = await request(`https://api.mightpulse.com/v1/${path}`, {
            method: 'GET', headers: { Authorization: `Bearer ${token}` }, redirect: 'error', signal: controller.signal,
          });
          quotaHeaders(response);
          if (response.status === 401 || response.status === 403) throw new OfficialMapError('upstream_auth', 503);
          if (response.status === 429) throw new OfficialMapError('rate_limited', 429, Math.max(1, Math.ceil((blockedUntil - now()) / 1000)));
          if (!response.ok) throw new OfficialMapError('upstream_error');
          const raw: unknown = await response.json();
          if (!object(raw) || raw.ok === false) throw new OfficialMapError('upstream_error');
          return raw;
        })(),
      ]);
    } catch (error) {
      if (error instanceof OfficialMapError) throw error;
      throw new OfficialMapError(controller.signal.aborted ? 'timeout' : 'upstream_error', controller.signal.aborted ? 504 : 502);
    } finally { clearTimeout(timer); signal.removeEventListener('abort', abort); }
  }

  async function collect(query: OfficialMapQuery, signal: AbortSignal): Promise<AllianceMapResponse> {
    const { kid, tag, offset } = query;
    if (tag === undefined) {
      const alliances = await ranks(String(kid), async () => {
        const raw = await upstream(`kingdoms/${kid}/ranks?board=alliance_power&limit=100`, signal);
        if (!object(raw) || !Array.isArray(raw.boards)) throw new OfficialMapError('upstream_error');
        const result = new Map<string, AllianceMapAlliance>();
        for (const board of raw.boards) {
          if (!object(board) || !Array.isArray(board.rows)) throw new OfficialMapError('upstream_error');
          for (const row of board.rows.slice(0, 100)) {
            if (!object(row) || row.kid !== kid) continue;
            const item = alliance(row);
            result.set(item.aid, item);
            if (result.size >= 100) break;
          }
          if (result.size >= 100) break;
        }
        return [...result.values()];
      });
      return { ok: true, kind: 'alliances', kid, alliances };
    }
    const roster = await rosters(`${kid}:${tag}`, async () => {
      const raw = await upstream(`alliances/${kid}/${encodeURIComponent(tag)}?include=info,roster`, signal);
      if (!object(raw) || raw.ok !== true || !Array.isArray(raw.members) || raw.members.length > MAX_ROSTER) {
        throw new OfficialMapError('upstream_error');
      }
      const info = alliance(raw.alliance);
      if (info.abbr !== tag || (object(raw.alliance) && raw.alliance.kid !== undefined && raw.alliance.kid !== kid)) {
        throw new OfficialMapError('upstream_error');
      }
      return { alliance: info, members: raw.members.map(member => object(member) ? realUid(member.uid) : null) };
    });
    if (offset > roster.members.length) throw new OfficialMapError('invalid_offset', 400);
    const batch = roster.members.slice(offset, offset + BATCH_SIZE);
    const cities: AllianceMapCity[] = [];
    let failed = 0, unlocated = 0, outside_kingdom = 0;
    for (const uid of batch) {
      signal.throwIfAborted();
      if (!uid) { failed++; continue; }
      try {
        const p = await profiles(uid, async () => profile(await upstream(`players/${uid}?id_type=uid&include=base`, signal), uid));
        if (p.kid === null || !Number.isInteger(p.kid) || p.kid < 1) { failed++; continue; }
        if (p.kid !== kid) { outside_kingdom++; continue; }
        if (p.x === null || p.y === null || p.x < 0 || p.x > 1200 || p.y < 0 || p.y > 1200) { unlocated++; continue; }
        const { cache_ttl_ms: _cacheTtl, ...city } = p;
        cities.push({ ...city, kid, x: p.x, y: p.y, shield_active: null, burn_active: null });
      } catch (error) {
        // Never turn authorization/quota failures into five ordinary missing players.
        if (error instanceof OfficialMapError && (error.status === 429 || error.status === 503)) throw error;
        failed++;
      }
    }
    const next = offset + batch.length;
    const { aid, abbr, name } = roster.alliance;
    return { ok: true, kind: 'positions', kid, tag, coverage: 'alliance_profiles', bounds: { min: 0, max: 1200 },
      cities, alliance: { aid, abbr, name }, roster_count: roster.members.length, processed: batch.length,
      next_offset: next < roster.members.length ? next : null, failed, unlocated, outside_kingdom };
  }

  return async (query: OfficialMapQuery): Promise<AllianceMapResponse> => {
    const requestKey = JSON.stringify([query.kid, query.tag, query.offset]);
    const pending = active.get(requestKey);
    if (pending) return pending;
    if (active.size >= 3) throw new OfficialMapError('rate_limited', 429, 2);
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const work = Promise.race([
      new Promise<never>((_, reject) => { timer = setTimeout(() => {
        controller.abort(); reject(new OfficialMapError('timeout', 504));
      }, REQUEST_TIMEOUT); }),
      collect(query, controller.signal),
    ]);
    active.set(requestKey, work);
    try { return await work; } finally { clearTimeout(timer); active.delete(requestKey); }
  };
}
