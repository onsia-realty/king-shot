export type PlayerIdType = 'uid' | 'governor_id';
export type PublicPlayer = {
  ok: true;
  uid: unknown;
  governor_id: unknown;
  player: Record<string, unknown>;
  heroes: unknown[];
  ranks: Record<string, unknown>;
  gov_gear: Record<string, unknown>;
  fresh: unknown;
  cached_at: unknown;
  age_seconds: number | null;
  source: 'web' | 'official';
};

export function playerId(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const id = String(value);
  return /^[0-9]{1,15}$/.test(id) && !/^0+$/.test(id) ? id.replace(/^0+/, '') : null;
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function numeric(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}
// Allow only named scalars, never raw provider objects, JSON strings or other players.
function pick(row: Record<string, unknown>, numbers: string, strings = '') {
  const out: Record<string, unknown> = {};
  for (const key of numbers.split(' ').filter(Boolean)) out[key] = numeric(row[key]) ? row[key] : null;
  for (const key of strings.split(' ').filter(Boolean)) out[key] = typeof row[key] === 'string' ? row[key].slice(0, 2048) : null;
  return out;
}
function rows(value: unknown, max: number, populated = false): Record<string, unknown>[] | null {
  return Array.isArray(value) && value.length <= max && (!populated || value.length > 0)
    && value.every(object) ? value : null;
}
function timestamp(value: unknown, now: number): number | null {
  // The public endpoint exposes Unix seconds. Future or absent source times are unknown.
  return numeric(value) && value > 0 && value * 1000 <= now ? value : null;
}

export function normalizeWebPlayer(value: unknown, expectedUid: string, expectedGovernorId?: string,
  now = Date.now()): PublicPlayer | null {
  if (!object(value) || value.ok === false || value.profile_populated === false) return null;
  const uid = playerId(value.uid), fid = playerId(value.fid), governorId = playerId(value.governor_id);
  if (!uid || uid !== expectedUid || !fid || !governorId || fid !== governorId
    || (expectedGovernorId !== undefined && governorId !== expectedGovernorId)) return null;
  if (typeof value.nick_name !== 'string' || !value.nick_name.trim() || !numeric(value.power)
    || !numeric(value.kid) || value.kid < 1 || !numeric(value.town_center_level)
    || typeof value.lords_gear_privacy !== 'boolean') return null;
  const heroRows = rows(value.heroes, 5, true);
  if (!heroRows || new Set(heroRows.map(hero => playerId(hero.id))).size !== heroRows.length) return null;
  const heroes: Record<string, unknown>[] = [];
  for (const hero of heroRows) {
    // A populated profile can have an unequipped hero or no unlocked skills.
    // Empty optional sections are valid; absent/malformed sections still fall back.
    const requireItems = value.profile_populated !== true;
    const gear = rows(hero.gear_tiles, 5, requireItems);
    const skills = rows(hero.skill_levels, 10, requireItems);
    if (!playerId(hero.id) || !numeric(hero.hero_level) || hero.hero_level < 1
      || !numeric(hero.pos) || hero.pos < 1 || hero.pos > 5
      || !numeric(hero.star_raw) || hero.star_raw > 30 || !gear || !skills
      || gear.some(item => !playerId(item.eid) || !numeric(item.slv) || !numeric(item.refine_level)
        || typeof item.exclusive !== 'boolean' || typeof item.slot !== 'string')
      || skills.some(skill => !playerId(skill.id) || !numeric(skill.level))) return null;
    const exclusive = gear.filter(item => item.exclusive === true);
    if (exclusive.length > 1) return null;
    heroes.push({
      ...pick(hero, 'id stars exclusive_gear_level', 'name icon star_label'),
      level: hero.hero_level, star: hero.star_raw, position: hero.pos,
      skill_levels: skills.map(skill => pick(skill, 'id level')),
      gear: gear.filter(item => !item.exclusive).map(item => ({
        ...pick(item, 'eid sid gear_level refine_level quality troop', 'slot name quality_key quality_label troop_label'),
        enhancement_level: item.slv, red: item.red === true,
      })),
      exclusive_gear: exclusive.length ? {
        id: exclusive[0].eid, level: exclusive[0].slv,
        ...pick(exclusive[0], '', 'name slot'),
      } : null,
    });
  }
  // Verified against renderLordsGearSection: true means hidden, even if items were included.
  const hidden = value.lords_gear_privacy;
  const gear = hidden ? [] : rows(value.lords_gear, 6, true);
  if (!gear || gear.some(item => !playerId(item.equipid) || typeof item.slot !== 'string'
    || !numeric(item.strength_level) || !rows(item.gems, 3)
    || (item.gems as Record<string, unknown>[]).some(gem => !playerId(gem.id) || !numeric(gem.slot)))) return null;
  const rankNames = 'power_rank kills_rank stove_rank migrant_rank mystic_rank'.split(' ');
  if (!rankNames.some(key => numeric(value[key])) || rankNames.some(key => value[key] != null && !numeric(value[key]))) return null;
  const ranks = pick(value, 'power_rank kills_rank migrant_rank mystic_rank power kills migrant_score mystic_trial town_center_level');
  ranks.town_center_rank = numeric(value.stove_rank) ? value.stove_rank : null;
  const leaderboards = rows(value.leaderboards, 30);
  if (leaderboards) ranks.leaderboards = leaderboards.map(row =>
    pick(row, 'value kingdom_rank rank_type', 'name value_label kingdom_rank_label'));
  const alliance = object(value.alliance) ? {
    ...pick(value.alliance, 'aid power count', 'abbr name flag_url leader_name'),
    rank: numeric(value.alliance_rank) ? value.alliance_rank : null,
    rank_label: typeof value.alliance_rank_label === 'string' ? value.alliance_rank_label.slice(0, 100) : null,
  } : null;
  const times = [value.detail_updated_at, value.arena_updated_at, value.stats_updated_at].map(time => timestamp(time, now));
  const cachedAt = times.every((time): time is number => time !== null) ? Math.min(...times) : null;
  const age = cachedAt === null ? null : Math.max(0, Math.floor(now / 1000 - cachedAt));
  return {
    ok: true, uid: value.uid, governor_id: value.governor_id,
    player: { ...pick(value, 'kid power town_center_level vip x y kills', 'nick_name avatar_url'), alliance },
    heroes, ranks,
    gov_gear: { hidden, message: hidden ? '영주 장비가 비공개로 설정되어 있습니다.' : null,
      items: gear.map(item => ({
        ...pick(item, 'equipid e_pid quality t_level strength_level star score combat', 'slot name icon quality_key tier'),
        gems: (item.gems as Record<string, unknown>[]).map(gem => pick(gem, 'slot id')),
      })) },
    // This is a snapshot, never a claim that the game was refreshed on this request.
    fresh: false, cached_at: cachedAt, age_seconds: age, source: 'web',
  };
}

export async function lookupWebPlayer(id: string, idType: PlayerIdType): Promise<PublicPlayer | null> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<null>(resolve => {
    timer = setTimeout(() => { controller.abort(); resolve(null); }, 5_000);
  });
  const get = async (path: string): Promise<unknown> => {
    controller.signal.throwIfAborted();
    const response = await fetch(`https://mightpulse.com${path}`, {
      signal: controller.signal, redirect: 'error', headers: {
        'User-Agent': 'kingshot-gongryak-site/1.0 (+https://xn--ob0bx7rdoh9mq.xyz)', Accept: 'application/json',
      },
    });
    if (!response.ok || !/^application\/(?:json|[\w.-]+\+json)(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '')) return null;
    return response.json();
  };
  try {
    return await Promise.race([expired, (async () => {
      let uid = id;
      if (idType === 'governor_id') {
        // Search returns {results:[{uid,fid,...}]}; a name/UID match is not a FID match.
        const result = await get(`/api/search?q=${encodeURIComponent(id)}&live=0`);
        if (!object(result) || result.ok === false || !Array.isArray(result.results)) return null;
        const matches = result.results.filter(object).filter(row => playerId(row.fid) === id);
        if (!matches.length || matches.some(row => !playerId(row.uid))
          || new Set(matches.map(row => playerId(row.uid))).size !== 1) return null;
        uid = playerId(matches[0].uid)!;
      }
      const value = await get(`/api/players/${uid}`);
      return normalizeWebPlayer(value, uid, idType === 'governor_id' ? id : undefined);
    })().catch(() => null)]);
  } finally { clearTimeout(timer); }
}
