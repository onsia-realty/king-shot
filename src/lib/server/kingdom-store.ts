import { neon } from '@neondatabase/serverless';
import { id, number, text } from './mightpulse-discovery.js';

// Reads from the Neon tables the GitHub Actions collector fills (migrations/002_kingdoms.sql).
type Row = Record<string, unknown>;
// The driver returns bigint/numeric columns as strings; coerce every number the same way.
const num = (value: unknown) => number(typeof value === 'string' && value.trim() !== '' ? Number(value) : value);
export const BOUNDS = { min: 0, max: 1200 };
const coordinate = (value: unknown) => { const n = num(value); return n !== null && n >= 0 && n <= 1200 ? n : null; };
const realUid = (value: unknown): string | null => {
  if (typeof value === 'number' && (!Number.isSafeInteger(value) || value <= 0)) return null;
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const raw = String(value);
  if (!/^\d{1,19}$/.test(raw)) return null;
  const n = BigInt(raw);
  return n > 0n && n <= 9223372036854775807n ? String(n) : null;
};
const positioned = (p: string) => `${p}.uid > 0 AND ${p}.profile_kid = ${p}.kid
  AND ${p}.x BETWEEN 0 AND 1200 AND ${p}.y BETWEEN 0 AND 1200`;

const upsert = (set: string) => `
WITH r AS (
  INSERT INTO public.kingdom_requests (kid) VALUES ($1)
  ON CONFLICT (kid) DO UPDATE SET ${set}
  RETURNING kid, requested_at, collected_at, located, total
)
SELECT (SELECT count(*) FROM public.players p WHERE p.kid=r.kid AND ${positioned('p')}) AS located,
  (SELECT count(*) FROM public.players p WHERE p.kid=r.kid AND p.uid>0) AS total,
  extract(epoch FROM r.collected_at) AS collected_at,
  CASE WHEN r.collected_at IS NULL THEN 1 + (SELECT count(*) FROM public.kingdom_requests q
    WHERE q.collected_at IS NULL AND q.kid <> r.kid AND q.requested_at <= r.requested_at) END AS queue_position,
  EXISTS (SELECT 1 FROM public.players p WHERE p.kid = r.kid) AS roster
FROM r`;
export const SQL = {
  // ponytail: reads register interest with a no-op update so RETURNING always yields the row; split into SELECT-then-INSERT if dead tuples matter.
  status: upsert('kid = excluded.kid'),
  // A still-queued kingdom keeps its place in line; a collected one asks the collector for a fresh pass.
  request: upsert(`request_count = public.kingdom_requests.request_count + 1,
    requested_at = CASE WHEN public.kingdom_requests.collected_at IS NULL THEN public.kingdom_requests.requested_at ELSE now() END`),
  cities: `SELECT uid, nick_name, power, tc, aid, alliance_abbr, kid, profile_kid, x, y,
  extract(epoch FROM profile_cached_at) AS profile_cached_at, extract(epoch FROM located_at) AS located_at
FROM public.players p WHERE kid = $1 AND ${positioned('p')}`,
  alliances: `SELECT a.aid, a.abbr, a.name, a.power, count(p.uid) AS city_count, round(avg(p.x)) AS cx, round(avg(p.y)) AS cy
FROM public.alliances a LEFT JOIN public.players p ON p.aid = a.aid AND p.kid=a.kid AND ${positioned('p')}
WHERE a.kid = $1 GROUP BY a.aid`,
  search: `SELECT p.uid, p.governor_id, p.nick_name, p.kid, p.power, p.tc, p.x, p.y, p.alliance_abbr, a.name AS alliance_name, p.avatar_url
FROM public.players p LEFT JOIN public.alliances a ON a.aid = p.aid
WHERE lower(p.nick_name) LIKE $1 AND ($2::int IS NULL OR p.kid = $2) ORDER BY p.power DESC NULLS LAST LIMIT 100`,
};

export async function query(statement: string, params: unknown[]): Promise<Row[]> {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error('storage_unavailable');
  // Driver details never reach the client: any failure is a plain "storage unavailable".
  return (neon(url).query(statement, params, { fetchOptions: { signal: AbortSignal.timeout(5000) } }) as Promise<Row[]>)
    .catch(() => { throw new Error('storage_unavailable'); });
}

export function notCollected(kid: number) {
  return { ok: false as const, error: 'not_collected', kid, queued: true,
    message: '이 왕국은 아직 수집되지 않았습니다. 수집 대기열에 등록했으니 잠시 후 다시 조회해 주세요.' };
}

// Registers interest in the kingdom (request=true also counts a refresh request) and reports where it stands.
export async function status(kid: number, request = false) {
  const rows = await query(request ? SQL.request : SQL.status, [kid]);
  const row = rows[0];
  if (rows.length !== 1 || !row) throw new Error('storage_unavailable');
  const collected_at = num(row.collected_at), located = num(row.located) ?? 0, total = num(row.total) ?? 0;
  return {
    // Legacy last_finished_at is the last saved batch, never a kingdom scan completion.
    // Existing search gates use this alias; consumers must use status/coverage for progress.
    status: collected_at !== null || located > 0 || total > 0 || row.roster === true ? 'partial' : 'queued',
    last_finished_at: collected_at, queue_position: num(row.queue_position),
    coverage: { located, total, collected_at },
  };
}

export async function loadMap(kid: number) {
  const now = Date.now() / 1000;
  const [rows, alliances] = await Promise.all([query(SQL.cities, [kid]), query(SQL.alliances, [kid])]);
  const cities = rows.filter(row => realUid(row.uid) !== null && num(row.kid) === kid && num(row.profile_kid) === kid
    && coordinate(row.x) !== null && coordinate(row.y) !== null);
  return {
    ok: true as const, kid, bounds: BOUNDS,
    source: 'official_profiles' as const, partial: true as const,
    stale: cities.length === 0 || cities.some(row => { const at = num(row.profile_cached_at); return at === null || now - at > 3 * 86400; }),
    cities: cities.map(row => ({
      uid: realUid(row.uid), nick_name: text(row.nick_name), power: num(row.power), tc: num(row.tc), stove_lv: null,
      kid, map_kid: null, aid: realUid(row.aid), alliance_abbr: text(row.alliance_abbr), x: coordinate(row.x), y: coordinate(row.y),
      shield_active: null, burn_active: null, city_skin_icon: null, profile_cached_at: num(row.profile_cached_at),
    })),
    alliances: alliances.filter(row => realUid(row.aid) !== null).map(row => ({
      aid: realUid(row.aid), abbr: text(row.abbr), name: text(row.name), city_count: num(row.city_count),
      cx: num(row.cx), cy: num(row.cy), power_sum: num(row.power), flag_url: null,
    })),
    updated_at: cities.reduce<number | null>((latest, row) => {
      const at = num(row.located_at);
      return at !== null && (latest === null || at > latest) ? at : latest;
    }, null),
  };
}

export async function search(q: string, kid: number | null) {
  const pattern = `%${q.toLowerCase().replace(/[\\%_]/g, '\\$&')}%`;
  const rows = await query(SQL.search, [pattern, kid]);
  return rows.map(row => ({
    uid: id(row.uid), fid: id(row.governor_id), nick_name: text(row.nick_name), kid: num(row.kid), power: num(row.power),
    town_center_level: num(row.tc), x: num(row.x), y: num(row.y), alliance_abbr: text(row.alliance_abbr),
    alliance_name: text(row.alliance_name), avatar_url: text(row.avatar_url),
  }));
}
