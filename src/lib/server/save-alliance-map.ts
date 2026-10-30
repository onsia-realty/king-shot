import type { AllianceMapPositionsResponse } from '../alliance-map.js';
import { query } from './kingdom-store.js';

// A successful interactive lookup contributes to the same persistent map as the collector.
// Source cache time, rather than request completion order, decides which position wins.
export const SAVE_POSITIONS_SQL = `
WITH saved_alliance AS (
  INSERT INTO public.alliances (aid, kid, abbr, name)
  VALUES ($2::bigint, $1, $3, $4)
  ON CONFLICT (aid) DO UPDATE SET abbr = excluded.abbr, name = excluded.name
  WHERE public.alliances.kid = excluded.kid
), saved_players AS (
  INSERT INTO public.players
    (uid, kid, nick_name, power, tc, aid, alliance_abbr, x, y,
     profile_kid, profile_cached_at, located_at, profile_attempted_at)
  SELECT uid, $1, coalesce(nick_name, uid::text), power, tc, aid, alliance_abbr,
    x, y, $1, to_timestamp(profile_cached_at), now(), now()
  FROM jsonb_to_recordset($5::jsonb) AS p
    (uid bigint, nick_name text, power bigint, tc integer, aid bigint,
     alliance_abbr text, x double precision, y double precision, profile_cached_at double precision)
  ON CONFLICT (uid) DO UPDATE SET
    kid = excluded.kid, nick_name = excluded.nick_name, power = excluded.power,
    tc = excluded.tc, aid = excluded.aid, alliance_abbr = excluded.alliance_abbr,
    x = excluded.x, y = excluded.y, profile_kid = excluded.profile_kid,
    profile_cached_at = excluded.profile_cached_at, located_at = excluded.located_at,
    profile_attempted_at = excluded.profile_attempted_at
  WHERE public.players.profile_cached_at IS NULL
     OR excluded.profile_cached_at >= public.players.profile_cached_at
)
INSERT INTO public.kingdom_requests (kid, collected_at) VALUES ($1, now())
ON CONFLICT (kid) DO UPDATE SET collected_at = excluded.collected_at
RETURNING kid`;

export async function saveAlliancePositions(
  data: AllianceMapPositionsResponse,
  run: typeof query = query,
): Promise<boolean> {
  const validId = (value: unknown) => typeof value === 'string' && /^[1-9][0-9]{0,14}$/.test(value);
  if (!Number.isInteger(data.kid) || data.kid < 1 || data.kid > 10000 || !validId(data.alliance.aid)) return false;
  const cities = [...new Map(data.cities.filter(city => city.kid === data.kid && validId(city.uid)
    && Number.isFinite(city.x) && Number.isFinite(city.y)
    && city.x >= 0 && city.x <= 1200 && city.y >= 0 && city.y <= 1200
    && (city.profile_cached_at === null || (Number.isFinite(city.profile_cached_at) && city.profile_cached_at > 0)))
    .map(city => [city.uid, city])).values()];
  if (!cities.length) return false;
  try {
    await run(SAVE_POSITIONS_SQL, [data.kid, data.alliance.aid, data.alliance.abbr, data.alliance.name, JSON.stringify(cities)]);
    return true;
  } catch {
    // A storage outage must not discard the successfully fetched live response or expose DB details.
    return false;
  }
}
