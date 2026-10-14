import { discoveryHandler, DiscoveryError, id, kingdom, number, object, text } from '../src/lib/server/mightpulse-discovery.js';

export default discoveryHandler({
  ttl: 5 * 60 * 1000,
  limit: 100,
  parse(params) {
    const query = (params.get('q') ?? '').trim();
    if (params.getAll('q').length !== 1 || query.length < 2 || query.length > 80
      || /[\u0000-\u001f\u007f]/.test(query)) throw new DiscoveryError('invalid_query');
    return { query, kid: kingdom(params, true) };
  },
  key: ({ query, kid }) => kid === null ? `search:${query}` : `kingdom:${kid}`,
  url: ({ query, kid }) => kid === null
    ? `https://mightpulse.com/api/search?q=${encodeURIComponent(query)}&live=0`
    : `https://mightpulse.com/api/map?kid=${kid}&layers=cities&limit=50000`,
  normalize(data, { kid }) {
    if (!object(data) || data.ok === false) throw new DiscoveryError('upstream_error');
    const rows = kid === null ? data.results : data.cities;
    if (!Array.isArray(rows)) throw new DiscoveryError('upstream_error');
    // A broken snapshot must not masquerade as a successful empty search.
    if (kid !== null && ((data.kid !== undefined && data.kid !== kid)
      || rows.some(row => !object(row) || id(row.uid) === null || typeof row.nick_name !== 'string'))) {
      throw new DiscoveryError('upstream_error');
    }
    const results = (kid === null ? rows.slice(0, 100) : rows).filter(object)
      .filter(row => id(row.uid) !== null || id(row.fid) !== null).map(row => ({
        uid: id(row.uid), fid: id(row.fid), nick_name: text(row.nick_name),
        kid: number(row.kid) ?? kid, power: number(row.power),
        town_center_level: number(kid === null ? row.town_center_level : row.tc),
        x: number(row.x), y: number(row.y), alliance_abbr: text(row.alliance_abbr),
        alliance_name: text(row.alliance_name), avatar_url: text(row.avatar_url),
      }));
    return { ok: true as const, query: '', results, total: results.length };
  },
  present(data, { query, kid }) {
    const results = (kid === null ? data.results : data.results.filter(row =>
      row.nick_name?.toLowerCase().includes(query.toLowerCase()))).slice(0, 100);
    return { ...data, query, results, total: results.length };
  },
});
