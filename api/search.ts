import { DiscoveryError, fetchData, id, kingdom, number, object, publicSnapshot, storeHandler, text } from '../src/lib/server/mightpulse-discovery.js';
import { search } from '../src/lib/server/kingdom-store.js';
import { coordinate, getMap, imageURL, validKingdom } from '../src/lib/server/mightpulse-map.js';

function normalizeResults(rows: unknown) {
  if (!Array.isArray(rows)) throw new DiscoveryError('upstream_error');
  const results = rows.slice(0, 100).filter(object).filter(row => id(row.uid) !== null || id(row.fid) !== null).map(row => ({
    uid: id(row.uid), fid: id(row.fid), nick_name: text(row.nick_name), kid: validKingdom(row.kid),
    power: number(row.power), town_center_level: number(row.town_center_level),
    x: coordinate(row.x), y: coordinate(row.y), alliance_abbr: text(row.alliance_abbr),
    alliance_name: text(row.alliance_name), avatar_url: imageURL(row.avatar_url),
  }));
  if (rows.length && !results.length) throw new DiscoveryError('upstream_error');
  return results;
}
const upstreamSearch = publicSnapshot(100, async (query: string) => {
  const data = await fetchData(`https://mightpulse.com/api/search?q=${encodeURIComponent(query)}&live=0`);
  if (!object(data) || data.ok === false) throw new DiscoveryError('upstream_error');
  const results = normalizeResults(data.results);
  return { results, partial: data.partial === true || (Array.isArray(data.results) && results.length < data.results.length), stale: data.stale === true };
});
type Results = ReturnType<typeof normalizeResults>;
const storedCache = new Map<string, { results: Results; storedAt: number }>();
const storedPending = new Map<string, Promise<Results>>();
async function storedSearch(query: string) {
  const cached = storedCache.get(query);
  if (cached && Date.now() - cached.storedAt < 30_000) return cached.results;
  let work = storedPending.get(query);
  if (!work) {
    work = search(query, null).then(rows => {
      const results = normalizeResults(rows);
      storedCache.delete(query);
      if (storedCache.size >= 100) storedCache.delete(storedCache.keys().next().value!);
      storedCache.set(query, { results, storedAt: Date.now() });
      return results;
    }).finally(() => { storedPending.delete(query); });
    storedPending.set(query, work);
  }
  return work;
}

export default storeHandler(100, async params => {
  const query = (params.get('q') ?? '').trim();
  if (params.getAll('q').length !== 1 || query.length < 2 || query.length > 80
    || /[\u0000-\u001f\u007f]/.test(query)) throw new DiscoveryError('invalid_query');
  const kid = kingdom(params, true);
  if (kid !== null) {
    const { data, seconds } = await getMap(kid, params.get('fresh') === '1');
    if (!data.ok) return [202, data];
    const alliances = new Map(data.alliances.map(row => [String(row.aid), row.name] as const));
    const results = data.cities.filter(row => row.nick_name?.toLowerCase().includes(query.toLowerCase())).slice(0, 100).map(row => ({
      uid: row.uid, fid: null, nick_name: row.nick_name, kid: row.kid, map_kid: row.map_kid,
      power: row.power, town_center_level: row.tc, x: row.x, y: row.y, alliance_abbr: row.alliance_abbr,
      alliance_name: alliances.get(String(row.aid)) ?? null, avatar_url: null,
    }));
    return [200, { ok: true, query, results, total: results.length, source: data.source, partial: data.partial, stale: data.stale }, seconds];
  }
  const hit = await upstreamSearch(query);
  if (hit) {
    const { results, partial } = hit.data;
    const stale = hit.stale || hit.data.stale;
    return [200, { ok: true, query, results, total: results.length, source: 'mightpulse', partial, stale }, stale ? 0 : hit.seconds];
  }
  const results = await storedSearch(query);
  return [200, { ok: true, query, results, total: results.length, source: 'official_profiles', partial: true, stale: true }];
});
