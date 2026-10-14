import { discoveryHandler, DiscoveryError, id, kingdom, number, object, text } from '../src/lib/server/mightpulse-discovery.js';

export default discoveryHandler({
  ttl: 10 * 60 * 1000,
  limit: 10,
  parse: params => ({ kid: kingdom(params)! }),
  key: ({ kid }) => String(kid),
  url: ({ kid }) => `https://mightpulse.com/api/map?kid=${kid}&layers=cities&limit=50000`,
  normalize(data, { kid }) {
    if (!object(data) || data.ok === false || !object(data.bounds)
      || !Array.isArray(data.cities) || !Array.isArray(data.alliances)) throw new DiscoveryError('upstream_error');
    const min = number(data.bounds.min), max = number(data.bounds.max);
    if (min === null || max === null || min < 0 || max <= min) throw new DiscoveryError('upstream_error');
    const coordinate = (value: unknown) => {
      const result = number(value);
      return result !== null && result >= min && result <= max ? result : null;
    };
    const cities = data.cities.slice(0, 50000).filter(object)
      .filter(row => id(row.uid) !== null && coordinate(row.x) !== null && coordinate(row.y) !== null)
      .map(row => ({
        uid: id(row.uid), nick_name: text(row.nick_name), power: number(row.power), tc: number(row.tc),
        stove_lv: number(row.stove_lv), kid: number(row.kid), map_kid: number(row.map_kid),
        aid: id(row.aid), alliance_abbr: text(row.alliance_abbr), x: coordinate(row.x), y: coordinate(row.y),
        shield_active: typeof row.shield_active === 'boolean' ? row.shield_active : null,
        burn_active: typeof row.burn_active === 'boolean' ? row.burn_active : null,
        city_skin_icon: text(row.city_skin_icon),
      }));
    const alliances = data.alliances.slice(0, 50000).filter(object).filter(row => id(row.aid) !== null).map(row => ({
      aid: id(row.aid), abbr: text(row.abbr), name: text(row.name), city_count: number(row.city_count),
      cx: coordinate(row.cx), cy: coordinate(row.cy), power_sum: number(row.power_sum), flag_url: text(row.flag_url),
    }));
    return { ok: true as const, kid, bounds: { min, max }, cities, alliances,
      updated_at: object(data.stats) ? number(data.stats.location_updated_at) : null };
  },
});
