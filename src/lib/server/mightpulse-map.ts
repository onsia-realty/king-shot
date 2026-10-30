import { DiscoveryError, fetchData, id, number, object, publicSnapshot, text } from './mightpulse-discovery.js';
import { loadMap, notCollected, status } from './kingdom-store.js';

// Reuse the public endpoint's allowlisted fields, never its arbitrary metadata or URLs.
export function imageURL(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048 || !value.trim()) return null;
  try {
    const url = new URL(value, 'https://mightpulse.com');
    return url.origin === 'https://mightpulse.com' && !url.username && !url.password
      && /^\/(?:assets|static)\/[\w/.-]+\.(?:png|webp|jpe?g)$/i.test(url.pathname)
      && !url.search && !url.hash ? url.href : null;
  } catch { return null; }
}
export const validKingdom = (value: unknown): number | null => {
  const n = number(value);
  return n !== null && Number.isInteger(n) && n >= 1 && n <= 10000 ? n : null;
};
export const coordinate = (value: unknown, min = 0, max = 1200): number | null => {
  const n = number(value);
  return n !== null && n >= min && n <= max ? n : null;
};

export function normalizeMap(data: unknown, kid: number) {
  if (!object(data) || data.ok === false || (data.kid !== undefined && data.kid !== kid)
    || !object(data.bounds) || !Array.isArray(data.cities) || !Array.isArray(data.alliances)) {
    throw new DiscoveryError('upstream_error');
  }
  const min = coordinate(data.bounds.min), max = coordinate(data.bounds.max);
  if (min === null || max === null || min >= max) throw new DiscoveryError('upstream_error');
  const seen = new Set<string>();
  const cities = data.cities.slice(0, 50000).filter(object).filter(row => {
    const uid = id(row.uid);
    // map_kid is the current location, kid is the home kingdom (visitors are valid).
    const location = row.map_kid == null ? validKingdom(row.kid) : validKingdom(row.map_kid);
    if (uid === null || location !== kid || coordinate(row.x, min, max) === null
      || coordinate(row.y, min, max) === null || seen.has(String(uid))) return false;
    seen.add(String(uid));
    return true;
  }).map(row => ({
    uid: id(row.uid), nick_name: text(row.nick_name), power: number(row.power), tc: number(row.tc),
    stove_lv: number(row.stove_lv), kid: validKingdom(row.kid), map_kid: validKingdom(row.map_kid),
    aid: id(row.aid), alliance_abbr: text(row.alliance_abbr), x: coordinate(row.x, min, max), y: coordinate(row.y, min, max),
    shield_active: typeof row.shield_active === 'boolean' ? row.shield_active : null,
    burn_active: typeof row.burn_active === 'boolean' ? row.burn_active : null,
    city_skin_icon: imageURL(row.city_skin_icon),
  }));
  // A nonempty broken snapshot must not replace a good map with an empty success.
  if (data.cities.length && !cities.length) throw new DiscoveryError('upstream_error');
  const allianceIds = new Set<string>();
  const alliances = data.alliances.slice(0, 50000).filter(object).filter(row => {
    const aid = id(row.aid);
    if (aid === null || allianceIds.has(String(aid))) return false;
    allianceIds.add(String(aid)); return true;
  }).map(row => ({
    aid: id(row.aid), abbr: text(row.abbr), name: text(row.name), city_count: number(row.city_count),
    cx: coordinate(row.cx, min, max), cy: coordinate(row.cy, min, max), power_sum: number(row.power_sum),
    flag_url: imageURL(row.flag_url),
  }));
  const timestamp = object(data.stats) ? number(data.stats.location_updated_at) : null;
  return { ok: true as const, kid, bounds: { min, max }, cities, alliances,
    updated_at: timestamp !== null && timestamp >= 0 ? timestamp : null,
    source: 'mightpulse' as const, partial: data.partial === true || data.cities.length >= 50000 || cities.length < data.cities.length,
    stale: data.stale === true };
}

const upstreamMap = publicSnapshot(10, async (kid: number) =>
  normalizeMap(await fetchData(`https://mightpulse.com/api/map?kid=${kid}&layers=cities&limit=50000`), kid));
async function storedMap(kid: number) {
  const state = await status(kid);
  const map = await loadMap(kid);
  if (map.cities.length === 0 && state.coverage.total === 0 && state.coverage.collected_at === null) return notCollected(kid);
  return { ...map, stale: true, coverage: { ...state.coverage, located: map.cities.length,
    total: Math.max(state.coverage.total, map.cities.length) } };
}
type Stored = Awaited<ReturnType<typeof storedMap>>;
const storedCache = new Map<number, { data: Stored; storedAt: number }>();
const storedPending = new Map<number, Promise<Stored>>();

export async function getMap(kid: number, fresh = false) {
  const hit = await upstreamMap(kid, fresh);
  if (hit) return { data: { ...hit.data, stale: hit.stale || hit.data.stale }, seconds: fresh || hit.stale || hit.data.stale ? 0 : hit.seconds };
  const cached = storedCache.get(kid);
  if (!fresh && cached && Date.now() - cached.storedAt < 30_000) return { data: cached.data, seconds: 0 };
  let work = storedPending.get(kid);
  if (!work) {
    if (storedPending.size >= 10) throw new DiscoveryError('rate_limited');
    work = storedMap(kid).then(data => {
      if (data.ok) {
        storedCache.delete(kid);
        if (storedCache.size >= 10) storedCache.delete(storedCache.keys().next().value!);
        storedCache.set(kid, { data, storedAt: Date.now() });
      }
      return data;
    }).finally(() => { storedPending.delete(kid); });
    storedPending.set(kid, work);
  }
  return { data: await work, seconds: 0 };
}
