/**
 * Official profiles -> persistent kingdom store; never creates schema.
 * KIDS=1622 MAX_CALLS=180 TOP_ALLIANCES=100 node scripts/collect-kingdoms.mjs
 * --probe reads usage only. KIDS is optional and strict; TOP_ALLIANCES defaults 100.
 * NEVER overlap manual/scheduled collectors: HTTP queries do not hold a session
 * advisory lock. The scheduler/operator MUST serialize all collector runs.
 * Ranked alliances are discovery coverage, NOT all citizens/unaligned players.
 * Atomic bulk rosters have per-alliance checkpoints. Failures go behind untried work.
 * Profiles alternate with rosters; kingdoms take turns across the persistent queue.
 * MAX_CALLS counts every billable attempt, including retries/timeouts. Unbilled
 * /usage calls are separately reported. Reserve >=200 daily calls for interactive use.
 */
import { neon } from '@neondatabase/serverless';
import { pathToFileURL } from 'node:url';

export const PACE_MS = 1650; // <=37 starts in any 60s window, including retries
export const TIMEOUT_MS = 25_000;
export const DAILY_RESERVE = 200;
const API = 'https://api.mightpulse.com/v1';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const finite = v => typeof v === 'number' && Number.isFinite(v) ? v : null;
const integer = v => Number.isSafeInteger(v) && v >= 0 ? v : null;
const label = v => typeof v === 'string' ? v.slice(0, 2048) : null;
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);

export function uid(value) {
  if (typeof value === 'number' && (!Number.isSafeInteger(value) || value <= 0)) return null;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const raw = String(value);
  if (!/^\d{1,19}$/.test(raw)) return null;
  const n = BigInt(raw);
  return n > 0n && n <= 9223372036854775807n ? String(n) : null;
}
export function coordinate(value) {
  return finite(value) !== null && value >= 0 && value <= 1200 ? value : null;
}
export function cachedAt(value) {
  if (typeof value === 'number' || (typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value))) {
    const seconds = Number(value);
    return Number.isFinite(seconds) && seconds >= 0 && seconds <= 253402300799 ? seconds : null;
  }
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const seconds = Date.parse(value) / 1000;
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}
function setting(value, fallback, max, name) {
  if (value === undefined) return fallback;
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(+value) || +value > max) throw new Error(`invalid_${name}`);
  return +value;
}
export function config(env = process.env) {
  // Scheduled Actions and the optional manual input supply an empty string.
  // Empty means process the saved queue, exactly like an omitted KIDS variable.
  const kids = env.KIDS === undefined || env.KIDS.trim() === '' ? [] : env.KIDS.split(',').map(part => {
    const raw = part.trim();
    if (!/^\d{1,5}$/.test(raw) || +raw < 1 || +raw > 10000) throw new Error('invalid_KIDS');
    return +raw;
  });
  return { kids: [...new Set(kids)], maxCalls: setting(env.MAX_CALLS, 180, 100000, 'MAX_CALLS'),
    topAlliances: setting(env.TOP_ALLIANCES, 100, 100, 'TOP_ALLIANCES') };
}

export function rankRows(body, kid, limit = 100) {
  const boards = Array.isArray(body?.boards) ? body.boards : body?.board ? [body.board] : null;
  if (!boards || boards.some(b => !Array.isArray(b?.rows))) throw new Error('invalid_ranks');
  const result = new Map();
  for (const board of boards) {
    for (const a of board.rows) {
      if (!object(a) || (a.kid !== undefined && a.kid !== kid)) continue;
      const aid = uid(a.aid), abbr = label(a.abbr);
      if (!aid || !abbr) continue;
      result.set(aid, { aid, kid, abbr, name: label(a.name), power: integer(a.score ?? a.power),
        member_count: integer(a.member_count), leader_name: label(a.leader_name) });
      if (result.size >= limit) return [...result.values()];
    }
  }
  return [...result.values()];
}
export function rosterRows(body, alliance, kid) {
  if (!Array.isArray(body?.members)) throw new Error('invalid_roster');
  const info = body.alliance ?? body;
  if ((info.aid !== undefined && uid(info.aid) !== uid(alliance.aid)) ||
      (info.kid !== undefined && info.kid !== kid) ||
      ((info.abbr ?? info.tag) !== undefined && (info.abbr ?? info.tag) !== alliance.abbr)) throw new Error('invalid_roster');
  const result = new Map();
  for (const m of body.members) {
    if (!object(m) || (m.kid !== undefined && m.kid !== kid)) continue;
    const id = uid(m.uid), name = label(m.nick_name);
    if (!id || !name) continue;
    result.set(id, { uid: id, governor_id: uid(m.governor_id), kid, nick_name: name, power: integer(m.power),
      tc: integer(m.town_center_level), aid: uid(alliance.aid), alliance_abbr: alliance.abbr, avatar_url: label(m.avatar_url) });
  }
  return [...result.values()];
}
export function profileRow(body, expectedUid, kid) {
  const p = body?.player;
  if (body?.ok !== true || !object(p) || !uid(expectedUid) || uid(body.uid) !== uid(expectedUid) || uid(p.uid) !== uid(expectedUid)) return null;
  if (!Number.isInteger(p.kid) || p.kid < 1 || p.kid > 100000) return null;
  const x = coordinate(p.x), y = coordinate(p.y);
  const located = p.kid === kid && x !== null && y !== null;
  return { uid: uid(expectedUid), profile_kid: p.kid, x: located ? x : null, y: located ? y : null,
    profile_cached_at: cachedAt(body.cached_at), power: integer(p.power), tc: integer(p.town_center_level), avatar_url: label(p.avatar_url) };
}

export function createApi({ key, maxCalls = 180, fetch: request = globalThis.fetch, wait = sleep, now = Date.now }) {
  let calls = 0, usageCalls = 0, budget = maxCalls, lastStart = -Infinity;
  async function get(path, counted = true) {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (counted && calls >= budget) return { status: 0, exhausted: true };
      await wait(Math.max(0, lastStart + PACE_MS - now()));
      lastStart = now();
      if (counted) calls++; else usageCalls++;
      const controller = new AbortController();
      let timer, result;
      try {
        result = await Promise.race([
          new Promise(resolve => { timer = setTimeout(() => { controller.abort(); resolve({ status: 0 }); }, TIMEOUT_MS); }),
          (async () => {
            const response = await request(`${API}${path}`, { headers: {
              Authorization: `Bearer ${key}`, Accept: 'application/json',
              'User-Agent': 'kingshot-gongryak-site/1.0 (+https://xn--ob0bx7rdoh9mq.xyz)',
            }, signal: controller.signal, redirect: 'error' });
            if (!response.ok) return { status: response.status, retryAfter: response.headers.get('retry-after') };
            const body = await response.json();
            return object(body) && body.ok === true ? { status: 200, body } : { status: 502 };
          })(),
        ]);
      } catch { result = { status: 0 }; }
      finally { clearTimeout(timer); }
      if (result.status === 401 || result.status === 403) throw new Error('upstream_auth');
      if (result.status === 429 && attempt === 0 && (!counted || calls < budget)) {
        const raw = result.retryAfter;
        const delay = raw && /^\d+$/.test(raw) ? +raw * 1000 : raw ? Date.parse(raw) - now() : 60_000;
        if (delay > 60_000) { budget = calls; return result; }
        await wait(Math.max(PACE_MS, Number.isFinite(delay) ? delay : 60_000));
        continue;
      }
      if (result.status === 429) budget = calls;
      return result;
    }
    return { status: 429 };
  }
  return { get, get calls() { return calls; }, get usageCalls() { return usageCalls; },
    get remaining() { return Math.max(0, budget - calls); },
    setDailyRemaining(value) {
      if (!Number.isSafeInteger(value) || value < 0) throw new Error('invalid_usage');
      budget = Math.min(maxCalls, calls + Math.max(0, value - DAILY_RESERVE));
      return budget;
    } };
}

const keepPosition = 'p.profile_kid = excluded.kid';
export const SQL = {
  seed: `INSERT INTO public.kingdom_requests (kid) VALUES ($1) ON CONFLICT (kid) DO NOTHING`,
  queue: `SELECT kid, ranks_at FROM public.kingdom_requests ORDER BY last_attempt_at NULLS FIRST, requested_at, kid`,
  touch: `UPDATE public.kingdom_requests SET last_attempt_at = clock_timestamp() WHERE kid = $1`,
  ranks: `WITH saved AS (
    INSERT INTO public.alliances AS a (aid,kid,abbr,name,power,member_count,leader_name,updated_at)
    SELECT aid,kid,abbr,name,power,member_count,leader_name,now() FROM jsonb_to_recordset($2::jsonb)
      AS r(aid bigint,kid integer,abbr text,name text,power bigint,member_count integer,leader_name text) WHERE true
    ON CONFLICT (aid) DO UPDATE SET kid=excluded.kid,abbr=excluded.abbr,name=excluded.name,power=excluded.power,
      member_count=excluded.member_count,leader_name=excluded.leader_name,updated_at=now(),
      roster_at=CASE WHEN a.kid=excluded.kid AND a.abbr=excluded.abbr THEN a.roster_at END,
      roster_attempted_at=CASE WHEN a.kid=excluded.kid AND a.abbr=excluded.abbr THEN a.roster_attempted_at END
    RETURNING aid
  ) UPDATE public.kingdom_requests SET ranks_at=now() WHERE kid=$1`,
  rosters: `SELECT * FROM (
    SELECT aid,abbr,roster_at,roster_attempted_at FROM public.alliances WHERE kid=$1
    ORDER BY power DESC NULLS LAST, aid LIMIT $2
  ) ranked WHERE (roster_at IS NULL OR roster_at < now()-interval '6 hours')
    AND (roster_attempted_at IS NULL OR roster_attempted_at < now()-interval '1 hour')
    ORDER BY roster_attempted_at NULLS FIRST, aid`,
  rosterAttempt: `UPDATE public.alliances SET roster_attempted_at=now() WHERE aid=$1 AND kid=$2`,
  roster: `WITH saved AS (
    INSERT INTO public.players AS p (uid,governor_id,kid,nick_name,power,tc,aid,alliance_abbr,avatar_url,roster_at)
    SELECT uid,governor_id,kid,nick_name,power,tc,aid,alliance_abbr,avatar_url,now()
    FROM jsonb_to_recordset($3::jsonb) AS r(uid bigint,governor_id bigint,kid integer,nick_name text,power bigint,
      tc integer,aid bigint,alliance_abbr text,avatar_url text) WHERE true
    ON CONFLICT (uid) DO UPDATE SET governor_id=COALESCE(excluded.governor_id,p.governor_id),kid=excluded.kid,
      nick_name=excluded.nick_name,power=excluded.power,tc=excluded.tc,aid=excluded.aid,
      alliance_abbr=excluded.alliance_abbr,avatar_url=COALESCE(excluded.avatar_url,p.avatar_url),roster_at=now(),
      x=CASE WHEN ${keepPosition} THEN p.x END,y=CASE WHEN ${keepPosition} THEN p.y END,
      located_at=CASE WHEN p.kid=excluded.kid AND p.aid IS NOT DISTINCT FROM excluded.aid OR ${keepPosition} THEN p.located_at END,
      profile_attempted_at=CASE WHEN p.kid=excluded.kid AND p.aid IS NOT DISTINCT FROM excluded.aid OR ${keepPosition} THEN p.profile_attempted_at END,
      shield_endtime=NULL,burn_endtime=NULL
    RETURNING uid
  ), checkpoint AS (
    UPDATE public.alliances SET roster_at=now(),roster_attempted_at=now()
    WHERE aid=$2 AND kid=$1 AND (SELECT count(*) FROM saved)>=0 RETURNING aid
  ) UPDATE public.kingdom_requests SET collected_at=now() WHERE kid=$1 AND EXISTS(SELECT 1 FROM checkpoint)`,
  // Spread initial coverage across alliances before filling the largest alliance.
  target: `WITH coverage AS (
    SELECT aid,count(*) AS located FROM public.players
    WHERE kid=$1 AND x IS NOT NULL AND y IS NOT NULL AND profile_kid=kid GROUP BY aid
  ) SELECT p.uid FROM public.players p
    LEFT JOIN coverage c ON p.aid IS NOT DISTINCT FROM c.aid
    WHERE p.kid=$1 AND (p.located_at IS NULL OR p.located_at < now()-interval '3 days')
    AND (p.profile_attempted_at IS NULL OR p.profile_attempted_at < now()-interval '1 hour')
    ORDER BY coalesce(c.located,0),p.profile_attempted_at NULLS FIRST,
      (p.x IS NULL) DESC,p.power DESC NULLS LAST,p.uid LIMIT 1`,
  profileAttempt: `UPDATE public.players SET profile_attempted_at=now() WHERE uid=$1 AND kid=$2`,
  profile: `WITH saved AS (
    UPDATE public.players SET x=$3,y=$4,profile_kid=$5,profile_cached_at=to_timestamp($6::double precision),
      avatar_url=COALESCE($7,avatar_url),power=COALESCE($8,power),tc=COALESCE($9,tc),
      located_at=now(),profile_attempted_at=now(),shield_endtime=NULL,burn_endtime=NULL
    WHERE uid=$1 AND kid=$2 AND (profile_cached_at IS NULL OR
      ($6::double precision IS NOT NULL AND profile_cached_at <= to_timestamp($6::double precision))) RETURNING uid
  ) UPDATE public.kingdom_requests SET collected_at=now() WHERE kid=$2 AND EXISTS(SELECT 1 FROM saved)`,
  missing: `WITH saved AS (
    UPDATE public.players SET x=NULL,y=NULL,profile_kid=NULL,profile_cached_at=NULL,shield_endtime=NULL,burn_endtime=NULL,
      located_at=now(),profile_attempted_at=now() WHERE uid=$1 AND kid=$2 RETURNING uid
  ) UPDATE public.kingdom_requests SET collected_at=now() WHERE kid=$2 AND EXISTS(SELECT 1 FROM saved)`,
};

export async function collect({ q, api, kids = [], topAlliances = 100, now = Date.now, onProgress = () => {} }) {
  for (const kid of kids) await q(SQL.seed, [kid]);
  const queue = await q(SQL.queue, []);
  let rosters = 0, located = 0, failed = 0, unlocated = 0, outside = 0;
  let reportedCalls = 0;
  const report = () => ({ calls: api.calls, rosters, located, failed, unlocated, outside });
  async function attempt(kid, path) {
    if (api.remaining <= 0) return { status: 0, exhausted: true };
    await q(SQL.touch, [kid]);
    return api.get(path);
  }
  async function profile(kid) {
    if (api.remaining <= 0) return false;
    const [target] = await q(SQL.target, [kid]);
    if (!target) return false;
    const id = uid(target.uid);
    if (!id) throw new Error('invalid_stored_uid');
    await q(SQL.profileAttempt, [id, kid]);
    const r = await attempt(kid, `/players/${id}?id_type=uid&include=base`);
    if (r.status === 404) { await q(SQL.missing, [id, kid]); unlocated++; return true; }
    const p = r.status === 200 ? profileRow(r.body, id, kid) : null;
    if (!p) { failed++; return true; }
    await q(SQL.profile, [id, kid, p.x, p.y, p.profile_kid, p.profile_cached_at, p.avatar_url, p.power, p.tc]);
    if (p.profile_kid !== kid) outside++; else if (p.x === null) unlocated++; else located++;
    return true;
  }
  async function* kingdomWork(row) {
    const kid = Number(row.kid);
    if (!row.ranks_at || now() - new Date(row.ranks_at).getTime() >= 6 * 3600_000) {
      const r = await attempt(kid, `/kingdoms/${kid}/ranks?board=alliance_power&limit=${topAlliances}`);
      if (r.status === 200) {
        let rows;
        try { rows = rankRows(r.body, kid, topAlliances); } catch { failed++; }
        if (rows) await q(SQL.ranks, [kid, JSON.stringify(rows)]);
      } else failed++;
      yield;
    }
    const alliances = await q(SQL.rosters, [kid, topAlliances]);
    for (const a of alliances) {
      if (api.remaining <= 0) return;
      await q(SQL.rosterAttempt, [a.aid, kid]);
      const r = await attempt(kid, `/alliances/${kid}/${encodeURIComponent(a.abbr)}?include=info,roster`);
      if (r.status === 200) {
        let members;
        try { members = rosterRows(r.body, a, kid); } catch { failed++; }
        if (members) { await q(SQL.roster, [kid, a.aid, JSON.stringify(members)]); rosters++; }
      } else failed++;
      yield;
      if (await profile(kid)) yield;
    }
    while (await profile(kid)) yield;
  }
  // One operation per kingdom per round; persisted attempt order works even with
  // MAX_CALLS smaller than the number of queued kingdoms.
  const workers = queue.map(row => kingdomWork(row));
  while (workers.length && api.remaining > 0) {
    for (let i = 0; i < workers.length && api.remaining > 0;) {
      if ((await workers[i].next()).done) workers.splice(i, 1); else i++;
      if (api.calls - reportedCalls >= 25) {
        onProgress(report()); reportedCalls = api.calls;
      }
    }
  }
  return report();
}

export async function main(env = process.env, argv = process.argv.slice(2)) {
  const options = config(env), probe = argv.includes('--probe');
  if (!env.MIGHTPULSE_API_KEY) throw new Error('missing_api_key');
  const url = env.DATABASE_URL || env.POSTGRES_URL;
  if (!probe && !url) throw new Error('missing_database_url');
  const api = createApi({ key: env.MIGHTPULSE_API_KEY, maxCalls: options.maxCalls });
  const usage = await api.get('/usage', false);
  const budget = api.setDailyRemaining(usage.body?.daily?.remaining);
  console.error(`[usage] remaining=${usage.body.daily.remaining} reserve=${DAILY_RESERVE} budget=${budget}`);
  if (probe || budget <= 0) return;
  const sql = neon(url);
  const q = (statement, params) => sql.query(statement, params, { fetchOptions: { signal: AbortSignal.timeout(TIMEOUT_MS) } });
  const summary = await collect({ q, api, ...options,
    onProgress: progress => console.log(JSON.stringify({ event: 'progress', at: new Date().toISOString(), ...progress })),
  });
  console.log(JSON.stringify({ ...summary, usage_calls: api.usageCalls }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    const safe = ['invalid_KIDS','invalid_MAX_CALLS','invalid_TOP_ALLIANCES','missing_api_key','missing_database_url','invalid_usage','upstream_auth'];
    console.error(`[collector] ${safe.includes(error?.message) ? error.message : 'collection_failed'}`);
    process.exitCode = 1;
  });
}
