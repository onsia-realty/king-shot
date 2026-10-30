import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { collect, config, createApi, rankRows, rosterRows, profileRow, coordinate, uid, cachedAt,
  SQL, PACE_MS, TIMEOUT_MS, DAILY_RESERVE } from '../scripts/collect-kingdoms.mjs';

const profile = (id = '11', over = {}, meta = {}) => ({ ok: true, uid: id,
  cached_at: '2026-10-29T00:00:00Z', player: { uid: id, kid: 1622, x: 0, y: 1200, ...over }, ...meta });
const alliance = (aid, abbr, kid = 1622) => ({ aid, abbr, kid, name: abbr, score: 900, member_count: 2 });

test('module imports without touching API, DB or process exit; strict optional configuration', () => {
  assert.deepEqual(config({}), { kids: [], maxCalls: 180, topAlliances: 100 });
  assert.deepEqual(config({ KIDS: '' }), config({}));
  assert.deepEqual(config({ KIDS: '  ' }), config({}));
  assert.deepEqual(config({ KIDS: '01622, 1623,1622', TOP_ALLIANCES: '1', MAX_CALLS: '2' }),
    { kids: [1622, 1623], maxCalls: 2, topAlliances: 1 });
  for (const KIDS of ['1,', ',1', '0', '-1', '1.5', '1e3', '10001', '1,bad']) assert.throws(() => config({ KIDS }), /invalid_KIDS/);
  for (const TOP_ALLIANCES of ['0', '101', '1.5', '', ' 2']) assert.throws(() => config({ TOP_ALLIANCES }));
  for (const MAX_CALLS of ['0', '-1', 'NaN', '1.5']) assert.throws(() => config({ MAX_CALLS }));
});

test('boards array and legacy board flatten multiple alliances, deduplicate and respect kingdom/limit', () => {
  const a = alliance('1', 'ONE'), b = alliance('2', 'TWO');
  const body = { boards: [{ rows: [a, { ...a, aid: 0 }] }, { rows: [a, b, alliance('3', 'WRONG', 9)] }] };
  assert.deepEqual(rankRows(body, 1622).map(a => a.aid), ['1', '2']);
  assert.equal(rankRows(body, 1622, 1).length, 1);
  assert.equal(rankRows({ board: { rows: [a] } }, 1622).length, 1);
  assert.throws(() => rankRows({}, 1622), /invalid_ranks/);
  assert.throws(() => rankRows({ boards: [{}] }, 1622), /invalid_ranks/);
});

test('rosters validate alliance identity and UIDs and bulk deduplicate 90 members', () => {
  const a = alliance('1', 'ONE');
  const members = Array.from({ length: 90 }, (_, i) => ({ uid: String(i + 1), nick_name: `player${i}` }));
  const rows = rosterRows({ alliance: a, members: [...members, members[0], { uid: 0, nick_name: 'bad' }] }, a, 1622);
  assert.equal(rows.length, 90);
  assert.equal(rows[0].kid, 1622);
  assert.equal(rows[0].aid, '1');
  assert.throws(() => rosterRows({ alliance: { ...a, aid: '2' }, members }, a, 1622));
  assert.throws(() => rosterRows({ alliance: { ...a, kid: 9 }, members }, a, 1622));
  assert.throws(() => rosterRows({ members: null }, a, 1622));
});

test('profile validates both source UIDs, actual kingdom and zero-inclusive finite coordinate pairs', () => {
  const good = profileRow(profile(), '11', 1622);
  assert.equal(good.x, 0); assert.equal(good.y, 1200);
  assert.equal(good.profile_kid, 1622);
  assert.equal(good.profile_cached_at, Date.parse('2026-10-29T00:00:00Z') / 1000);
  for (const v of [null, undefined, false, '', '0', NaN, Infinity, -1, 1201]) {
    assert.equal(coordinate(v), null);
    const p = profileRow(profile('11', { x: v }), '11', 1622);
    assert.equal(p.x, null); assert.equal(p.y, null);
  }
  assert.equal(coordinate(12.5), 12.5);
  for (const bad of [profile('11', { uid: '12' }), profile('11', {}, { uid: '12' }),
    profile('11', {}, { uid: null }), profile('11', { kid: null }), profile('11', { kid: '1622' })]) {
    assert.equal(profileRow(bad, '11', 1622), null);
  }
  const war = profileRow(profile('11', { kid: 9999 }), '11', 1622);
  assert.equal(war.profile_kid, 9999); assert.equal(war.x, null); assert.equal(war.y, null);
  assert.equal(profileRow(profile('11', {}, { cached_at: null }), '11', 1622).profile_cached_at, null);
  assert.equal(cachedAt('1793232000.5'), 1793232000.5);
  assert.equal(uid('9223372036854775807'), '9223372036854775807');
  for (const bad of [0, '-1', '0', 'NaN', 2 ** 54, '9223372036854775808']) assert.equal(uid(bad), null);
});

function client(maxCalls, responses) {
  let time = 0;
  const starts = [], waits = [];
  const api = createApi({ key: 'test-secret', maxCalls, now: () => time,
    wait: async ms => { time += ms; waits.push(ms); },
    fetch: async (_url, options) => {
      assert.ok(options.signal instanceof AbortSignal);
      assert.equal(options.redirect, 'error');
      starts.push(time);
      const value = responses.shift();
      if (value instanceof Error) throw value;
      return value ?? Response.json({ ok: true });
    } });
  return { api, starts, waits };
}

test('actual retry attempts consume budget without overshoot and >=200 daily reserve is enforced', async () => {
  assert.ok(DAILY_RESERVE >= 200); assert.ok(PACE_MS >= 1600); assert.ok(TIMEOUT_MS <= 25000);
  const c = client(3, [new Response(null, { status: 429, headers: { 'retry-after': '0' } })]);
  assert.equal(c.api.setDailyRemaining(202), 2);
  assert.equal((await c.api.get('/players/11')).status, 200);
  assert.equal(c.api.calls, 2);
  assert.equal((await c.api.get('/players/12')).exhausted, true);
  assert.equal(c.starts.length, 2);
  assert.ok(c.starts[1] - c.starts[0] >= PACE_MS);
  const one = client(1, [new Response(null, { status: 429 })]);
  await one.api.get('/players/11');
  assert.equal(one.starts.length, 1);
  assert.equal(one.api.remaining, 0);
  const zero = client(10, []);
  assert.equal(zero.api.setDailyRemaining(199), 0);
  await zero.api.get('/players/11');
  assert.equal(zero.starts.length, 0);
});

test('all request starts are paced; usage separately counted, errors contain no body or secrets', async () => {
  const c = client(40, []);
  await c.api.get('/usage', false);
  for (let i = 0; i < 40; i++) await c.api.get('/players/11');
  assert.equal(c.api.calls, 40); assert.equal(c.api.usageCalls, 1);
  for (let i = 1; i < c.starts.length; i++) assert.ok(c.starts[i] - c.starts[i - 1] >= 1600);
  assert.ok(c.starts[37] - c.starts[0] > 60000);
  const auth = client(2, [new Response('secret DATABASE_URL', { status: 401 })]);
  await assert.rejects(auth.api.get('/players/11'), { message: 'upstream_auth' });
  const network = client(2, [new Error('postgresql://secret')]);
  assert.deepEqual(await network.api.get('/players/11'), { status: 0 });
  const rate = client(3, [new Response(null, { status: 429, headers: { 'retry-after': '999' } })]);
  await rate.api.get('/players/11');
  assert.equal(rate.api.remaining, 0); assert.equal(rate.starts.length, 1);
});

test('25 second timeout includes stalled response body and consumes exactly one call', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let signal;
  const api = createApi({ key: 'fake', maxCalls: 1, wait: async () => {}, fetch: async (_url, options) => {
    signal = options.signal;
    return { ok: true, json: () => new Promise(() => {}) };
  } });
  const pending = api.get('/players/11');
  await Promise.resolve(); await Promise.resolve();
  t.mock.timers.tick(24999); assert.equal(signal.aborted, false);
  t.mock.timers.tick(1); assert.deepEqual(await pending, { status: 0 });
  assert.equal(signal.aborted, true); assert.equal(api.calls, 1);
});

// Stateful fixture: no DB driver/network. Tracks committed checkpoints across collect() runs.
function fixture(kids = [1622]) {
  const state = { time: Date.parse('2026-10-30T00:00:00Z'), requests: kids.map(kid => ({ kid, ranks_at: null, attempt: 0 })),
    alliances: new Map(), players: new Map(), writes: [], paths: [], failTags: new Set(), badProfiles: new Map() };
  const q = async (sql, p) => {
    const name = Object.keys(SQL).find(key => SQL[key] === sql);
    assert.ok(name, 'known SQL statement');
    state.writes.push([name, p]);
    const row = state.requests.find(r => r.kid === p[0]);
    if (name === 'queue') return [...state.requests].sort((a, b) => a.attempt - b.attempt).map(r => ({ ...r }));
    if (name === 'touch') row.attempt = ++state.time;
    if (name === 'ranks') {
      row.ranks_at = new Date(state.time).toISOString();
      for (const a of JSON.parse(p[1])) state.alliances.set(a.aid, { ...state.alliances.get(a.aid), ...a });
    }
    if (name === 'rosters') return [...state.alliances.values()].filter(a => a.kid === p[0]).slice(0, p[1])
      .filter(a => !a.roster_at && (!a.attempt || state.time - a.attempt >= 3600000)).sort((a, b) => (a.attempt ?? 0) - (b.attempt ?? 0));
    if (name === 'rosterAttempt') state.alliances.get(String(p[0])).attempt = state.time;
    if (name === 'roster') {
      for (const m of JSON.parse(p[2])) state.players.set(m.uid, { ...state.players.get(m.uid), ...m });
      state.alliances.get(String(p[1])).roster_at = state.time;
    }
    if (name === 'target') return [...state.players.values()].filter(m => m.kid === p[0] && !m.located_at &&
      (!m.attempt || state.time - m.attempt >= 3600000)).sort((a, b) => (a.attempt ?? 0) - (b.attempt ?? 0)).slice(0, 1);
    if (name === 'profileAttempt') state.players.get(p[0]).attempt = state.time;
    if (name === 'profile') Object.assign(state.players.get(p[0]), { x: p[2], y: p[3], profile_kid: p[4], profile_cached_at: p[5], located_at: state.time });
    if (name === 'missing') Object.assign(state.players.get(p[0]), { x: null, y: null, located_at: state.time });
    return [];
  };
  async function run(maxCalls, options = {}) {
    const api = createApi({ key: 'fixture', maxCalls, now: () => state.time, wait: async ms => { state.time += ms; },
      fetch: async url => {
        const path = new URL(url).pathname;
        state.paths.push(path);
        if (path.includes('/ranks')) {
          const kid = +path.split('/')[3];
          return Response.json({ ok: true, boards: [{ rows: [alliance(`${kid}1`, 'ONE', kid)] }, { rows: [alliance(`${kid}2`, 'TWO', kid)] }] });
        }
        if (path.includes('/alliances/')) {
          const [, , , kidText, tag] = path.split('/');
          if (state.failTags.has(tag)) return new Response(null, { status: 503 });
          const kid = +kidText, aid = `${kid}${tag === 'ONE' ? 1 : 2}`;
          return Response.json({ ok: true, alliance: alliance(aid, tag, kid),
            members: Array.from({ length: 90 }, (_, i) => ({ uid: `${aid}${String(i).padStart(2, '0')}`, nick_name: `player${i}` })) });
        }
        const id = path.split('/').at(-1), stored = state.players.get(id);
        const bad = state.badProfiles.get(id);
        return bad === 404 ? new Response(null, { status: 404 }) : Response.json(bad ?? profile(id, { kid: stored.kid }));
      } });
    return collect({ q, api, now: () => state.time, ...options });
  }
  return { state, run };
}

test('budget-limited runs resume per-alliance without rank/roster reset; bulk 90-member writes and partial cities', async () => {
  const f = fixture();
  const first = await f.run(3); // ranking, ONE roster, first ONE profile
  assert.equal(first.calls, 3); assert.equal(first.rosters, 1); assert.equal(first.located, 1);
  assert.equal(f.state.players.size, 90);
  assert.equal(f.state.writes.filter(([name]) => name === 'roster').length, 1);
  assert.equal(JSON.parse(f.state.writes.find(([name]) => name === 'roster')[1][2]).length, 90);
  const second = await f.run(2); // TWO roster and first pending profile
  assert.equal(second.calls, 2); assert.equal(f.state.players.size, 180);
  assert.equal(f.state.paths.filter(path => path.endsWith('/ranks')).length, 1);
  assert.equal(f.state.paths.filter(path => path.endsWith('/ONE')).length, 1);
  assert.equal(f.state.paths.filter(path => path.endsWith('/TWO')).length, 1);
  assert.ok([...f.state.players.values()].some(p => p.x === 0));
});

test('scheduled empty kingdom input processes existing queue and reports progress without profile data', async () => {
  const f = fixture();
  const reports = [];
  const result = await f.run(55, { ...config({ KIDS: '' }), onProgress: p => reports.push(p) });
  assert.equal(result.calls, 55);
  assert.deepEqual(reports.map(p => p.calls), [25, 50]);
  assert.ok(result.located > 0);
  for (const p of reports) assert.deepEqual(Object.keys(p).sort(), ['calls', 'failed', 'located', 'outside', 'rosters', 'unlocated']);
});

test('a failing first alliance does not block a later one, and unknown/failed/404 profiles are distinct', async () => {
  const f = fixture(); f.state.failTags.add('ONE');
  const first = await f.run(4); // ranks, failure, TWO, profile
  assert.equal(first.rosters, 1); assert.equal(first.failed, 1); assert.equal(first.located, 1);
  const pending = [...f.state.players.values()].filter(p => !p.located_at).slice(0, 4);
  const [bad, missing, unknown, war] = pending;
  Object.assign(bad, { x: 100, y: 200 });
  Object.assign(missing, { x: 100, y: 200 });
  f.state.badProfiles.set(bad.uid, profile(bad.uid, {}, { uid: '999' }));
  f.state.badProfiles.set(missing.uid, 404);
  f.state.badProfiles.set(unknown.uid, profile(unknown.uid, { x: null }));
  f.state.badProfiles.set(war.uid, profile(war.uid, { kid: 9999 }));
  const second = await f.run(4);
  assert.equal(second.failed, 1); assert.equal(second.unlocated, 2); assert.equal(second.outside, 1);
  assert.equal(bad.x, 100); assert.equal(bad.located_at, undefined);
  assert.equal(missing.x, null); assert.equal(unknown.x, null); assert.equal(war.x, null);
  assert.equal(f.state.paths.filter(path => path.endsWith('/ONE')).length, 1);
});

test('kingdom turns are fair within a run and across tiny runs without resetting queue order', async () => {
  const f = fixture([1622, 1623, 1624]);
  for (let i = 0; i < 3; i++) await f.run(1);
  assert.deepEqual(f.state.paths.map(path => +path.split('/')[3]), [1622, 1623, 1624]);
  await f.run(3);
  assert.deepEqual(f.state.paths.slice(3).map(path => +path.split('/')[3]), [1622, 1623, 1624]);
});

test('SQL safety: atomic bulk checkpoint, stale XY clearing, source-time conditional writes, additive DDL', async () => {
  assert.match(SQL.roster, /jsonb_to_recordset\(\$3::jsonb\)/);
  assert.match(SQL.roster, /checkpoint AS/);
  assert.match(SQL.roster, /x=CASE WHEN p\.profile_kid = excluded\.kid THEN p\.x END/);
  assert.match(SQL.roster, /profile_attempted_at=CASE/);
  assert.match(SQL.profile, /profile_cached_at <= to_timestamp/);
  assert.match(SQL.missing, /x=NULL,y=NULL/);
  assert.match(SQL.rosters, /roster_at < now\(\)-interval '6 hours'/);
  assert.match(SQL.rosters, /ORDER BY roster_attempted_at NULLS FIRST/);
  assert.match(SQL.queue, /ORDER BY last_attempt_at NULLS FIRST/);
  const ddl = await readFile(new URL('../migrations/002_kingdoms.sql', import.meta.url), 'utf8');
  assert.doesNotMatch(ddl, /\b(?:DROP|TRUNCATE|DELETE|ALTER)\b/i);
  for (const column of ['ranks_at', 'last_attempt_at', 'roster_attempted_at', 'profile_cached_at', 'profile_kid', 'profile_attempted_at']) assert.ok(ddl.includes(column));
});
