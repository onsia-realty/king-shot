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
  key: ({ query }) => query,
  url: ({ query }) => `https://mightpulse.com/api/search?q=${encodeURIComponent(query)}&live=0`,
  normalize(data, { query }) {
    if (!object(data) || !Array.isArray(data.results) || data.ok === false) throw new DiscoveryError('upstream_error');
    const results = data.results.slice(0, 100).filter(object)
      .filter(row => id(row.uid) !== null || id(row.fid) !== null).map(row => ({
        uid: id(row.uid), fid: id(row.fid), nick_name: text(row.nick_name),
        kid: number(row.kid), power: number(row.power), town_center_level: number(row.town_center_level),
        x: number(row.x), y: number(row.y), alliance_abbr: text(row.alliance_abbr),
        alliance_name: text(row.alliance_name), avatar_url: text(row.avatar_url),
      }));
    return { ok: true as const, query, results, total: results.length };
  },
  present(data, { kid }) {
    const results = kid === null ? data.results : data.results.filter(row => row.kid === kid);
    return { ...data, results, total: results.length };
  },
});
