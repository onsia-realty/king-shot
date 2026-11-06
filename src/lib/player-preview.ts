import type { ArenaHero } from '../components/islands/ArenaHeroes';
import type { MapCity } from '../components/islands/KingdomMapCanvas';
import type { PlayerIdType } from '../components/islands/PlayerDiscovery';

type Scalar = string | number | null;
interface GovernorGear {
  slot?: Scalar; name?: string; quality?: Scalar; tier?: Scalar; star?: Scalar;
  strength_level?: Scalar; score?: Scalar; combat?: Scalar; icon?: string;
  gems?: { slot?: Scalar; id?: Scalar }[];
}
export interface LookupResult {
  ok: boolean; governor_id?: Scalar; uid?: Scalar; message?: string;
  player?: {
    nick_name?: string; kid?: Scalar; power?: Scalar; town_center_level?: Scalar;
    vip?: Scalar; x?: Scalar; y?: Scalar; kills?: Scalar; avatar_url?: string;
    alliance?: { aid?: Scalar; abbr?: string; name?: string; rank?: Scalar; rank_label?: string;
      power?: Scalar; count?: Scalar; flag_url?: string; leader_name?: string } | null;
  } | null;
  heroes?: ArenaHero[] | null; ranks?: Record<string, Scalar> | null;
  gov_gear?: { hidden?: boolean; message?: string; items?: GovernorGear[] | null } | null;
  fresh?: boolean | null; cached_at?: Scalar; age_seconds?: Scalar; source?: 'web' | 'official';
}
export interface MapPlayerPreview {
  city: MapCity;
  kid: number;
  updated_at?: number | string | null;
  source?: string;
}
export function playerIdentity(value: unknown, type: PlayerIdType): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const id = String(value).trim();
  return /^\d{1,15}$/.test(id) && /[1-9]/.test(id) ? `${type}:${id.replace(/^0+/, '')}` : null;
}
export function matchesPlayer(result: LookupResult, value: string, type: PlayerIdType): boolean {
  const key = playerIdentity(value, type);
  return key !== null && key === playerIdentity(result[type], type);
}
export function mapPlayerResult(preview: MapPlayerPreview, value: string, type: PlayerIdType): LookupResult | null {
  const { city } = preview;
  if (type !== 'uid' || playerIdentity(city.uid, 'uid') !== playerIdentity(value, type) || !playerIdentity(value, type)) return null;
  return { ok: true, uid: city.uid, player: {
    nick_name: city.nick_name ?? undefined, kid: preview.kid, power: city.power,
    town_center_level: city.tc, x: city.x, y: city.y,
    // Missing map alliance metadata is unknown, never evidence of no alliance.
    alliance: city.alliance_abbr || (city.aid != null && String(city.aid) !== '0')
      ? { aid: city.aid, abbr: city.alliance_abbr ?? undefined } : undefined,
  } };
}

type Check = (value: unknown) => boolean;
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const scalar: Check = v => v == null || typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v));
const text: Check = v => v == null || typeof v === 'string';
const boolean: Check = v => v == null || typeof v === 'boolean';
const fields = (names: string, check: Check) => Object.fromEntries(names.split(' ').map(name => [name, check]));
const shape = (checks: Record<string, Check>): Check => v => object(v) && Object.entries(checks).every(([key, check]) => check(v[key]));
const optional = (check: Check): Check => v => v == null || check(v);
const array = (check: Check): Check => v => Array.isArray(v) && v.every(check);
const gem = shape(fields('slot id', scalar));
const heroGear = shape({ ...fields('eid sid slot enhancement_level refine_level gear_level quality troop', scalar),
  ...fields('name quality_key quality_label troop_label', text), red: boolean });
const hero = shape({ ...fields('id level star stars position exclusive_gear_level', scalar), ...fields('name icon star_label', text),
  skill_levels: optional(array(shape(fields('id level', scalar)))), gear: optional(array(heroGear)),
  exclusive_gear: optional(shape({ ...fields('id level slot', scalar), name: text,
    slg_attr: optional(array(shape({ ...fields('id value', scalar), label: text }))) })),
});
const fullResult = shape({
  ...fields('uid governor_id cached_at age_seconds', scalar), message: text, fresh: boolean,
  source: v => v == null || v === 'web' || v === 'official',
  player: shape({ ...fields('kid power town_center_level vip x y kills', scalar), ...fields('nick_name avatar_url', text),
    alliance: optional(shape({ ...fields('aid rank power count', scalar), ...fields('abbr name rank_label flag_url leader_name', text) })) }),
  // The provider also includes structured metadata such as ranks.leaderboards.
  // Validate only the scalar fields rendered by PlayerLookup.
  heroes: array(hero), ranks: shape(fields('power_rank power kills_rank kills town_center_rank town_center_level migrant_rank migrant_score mystic_rank mystic_trial', scalar)),
  gov_gear: shape({ hidden: boolean, message: text, items: optional(array(shape({
    ...fields('slot quality tier star strength_level score combat', scalar), ...fields('name icon', text), gems: optional(array(gem)),
  }))) }),
});
export function isFullPlayerResult(value: unknown): value is LookupResult {
  return object(value) && value.ok === true && fullResult(value)
    && (playerIdentity(value.uid, 'uid') !== null || playerIdentity(value.governor_id, 'governor_id') !== null);
}

export const PLAYER_CACHE_KEY = 'ks-player-profiles-v1';
export const PLAYER_CACHE_TTL = 30 * 60 * 1000;
export const PLAYER_CACHE_LIMIT = 20;
export interface SavedPlayer { result: LookupResult; savedAt: number }
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>;
export function createPlayerCache(storage: () => Storage = () => sessionStorage, now = Date.now) {
  let entries: SavedPlayer[] = [];
  let loaded = false;
  const valid = (entry: unknown): entry is SavedPlayer => object(entry) && typeof entry.savedAt === 'number'
    && Number.isFinite(entry.savedAt) && entry.savedAt <= now() && now() - entry.savedAt < PLAYER_CACHE_TTL
    && isFullPlayerResult(entry.result);
  function read() {
    if (!loaded) {
      loaded = true;
      try {
        const data = JSON.parse(storage().getItem(PLAYER_CACHE_KEY) ?? 'null');
        if (data?.version === 1 && Array.isArray(data.entries)) entries = data.entries.filter(valid);
      } catch { /* Invalid or unavailable storage must not block a lookup. */ }
    }
    entries = entries.filter(valid).sort((a, b) => a.savedAt - b.savedAt).slice(-PLAYER_CACHE_LIMIT);
  }
  return {
    get(value: string, type: PlayerIdType): SavedPlayer | undefined {
      read();
      for (let i = entries.length - 1; i >= 0; i--) {
        if (matchesPlayer(entries[i].result, value, type)) return entries[i];
      }
      return undefined;
    },
    put(value: string, type: PlayerIdType, result: unknown): boolean {
      if (!isFullPlayerResult(result) || !matchesPlayer(result, value, type)) return false;
      read();
      // Aliases are derived from verified full responses, always in separate namespaces.
      entries = entries.filter(entry => !(['uid', 'governor_id'] as const).some(alias => {
        const key = playerIdentity(result[alias], alias);
        return key !== null && key === playerIdentity(entry.result[alias], alias);
      }));
      entries.push({ result, savedAt: now() });
      entries = entries.slice(-PLAYER_CACHE_LIMIT);
      try { storage().setItem(PLAYER_CACHE_KEY, JSON.stringify({ version: 1, entries })); } catch { /* Keep the memory cache. */ }
      return true;
    },
  };
}
export const playerCache = createPlayerCache();
