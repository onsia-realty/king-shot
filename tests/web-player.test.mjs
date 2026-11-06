import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const compile = async path => ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const [webSource, handlerSource, guardSource] = await Promise.all([
  compile('../src/lib/server/web-player.ts'), compile('../api/player.ts'), compile('../src/lib/server/same-site.ts'),
]);
let serial = 0;
const moduleURL = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}#${serial++}`;
const web = await import(moduleURL(webSource));
const flush = () => new Promise(resolve => setImmediate(resolve));
const now = 1_800_000_000_000;
// Deliberately synthetic IDs, names and stats; no real account fixtures in tests.
function fixture() {
  return {
    uid: 101, fid: 202, governor_id: 202, profile_populated: true, nick_name: 'Synthetic',
    kid: 10, power: 1234, town_center_level: 40, vip: 8, kills: 12, x: 100, y: 200,
    avatar_url: '/assets/icons/example.png', alliance_rank: 3, alliance_rank_label: 'R3',
    alliance: { aid: 303, name: 'Example', abbr: 'EX', count: 20, online: 'SECRET' },
    power_rank: 12, kills_rank: 13, stove_rank: 14, migrant_rank: 15, mystic_rank: 16,
    leaderboards: [{ name: 'Personal Power', value: 1234, kingdom_rank: 12, rank_type: 3, raw: 'SECRET' }],
    detail_updated_at: now / 1000 - 60, arena_updated_at: now / 1000 - 120, stats_updated_at: now / 1000 - 180,
    heroes: [{ id: 50012, hero_level: 80, pos: 1, star_raw: 26, stars: 4, star_label: '4-Star (Tier 2)',
      name: 'Example hero', exclusive_gear_level: 2, rawjson: 'SECRET',
      skill_levels: [{ id: 500121, level: 5, raw: 'SECRET' }],
      gear_tiles: [
        { eid: 1012501, sid: 1, slot: 'Helmet', slv: 60, refine_level: 4, gear_level: 60,
          quality: 5, quality_key: 'mythic', red: false, troop: 2, exclusive: false, raw: 'SECRET' },
        { eid: 1050012, sid: 0, slot: 'Exclusive', slv: 2, refine_level: 0, gear_level: 2,
          name: 'Example weapon', exclusive: true, raw: 'SECRET' },
      ] }],
    lords_gear_privacy: false,
    lords_gear: [{ equipid: 1007, slot: 'Helmet', name: 'Example helmet', strength_level: 7, quality: 4,
      gems: [{ id: 203, slot: 1, private: 'SECRET' }], raw: 'SECRET' }],
    rawjson: 'SECRET', online: 'SECRET', last_login: 'SECRET', alliance_members: [{ uid: 404 }],
  };
}
function official() {
  return { ok: true, uid: 101, governor_id: 202, player: { nick_name: 'Official' },
    heroes: [{ id: 50012 }], ranks: { power_rank: 12 }, gov_gear: { hidden: false, items: [] },
    cached_at: now / 1000 - 20, age_seconds: 20, fresh: false };
}
async function setup(t, key = true) {
  const previous = process.env.MIGHTPULSE_API_KEY;
  if (key) process.env.MIGHTPULSE_API_KEY = 'synthetic-key';
  else delete process.env.MIGHTPULSE_API_KEY;
  t.after(() => { if (previous === undefined) delete process.env.MIGHTPULSE_API_KEY; else process.env.MIGHTPULSE_API_KEY = previous; });
  return (await import(moduleURL(handlerSource.replace('../src/lib/server/web-player.js', moduleURL(webSource))
    .replace('../src/lib/server/same-site.js', moduleURL(guardSource))))).default;
}
async function request(handler, query = 'id=101&id_type=uid') {
  const out = { status: 200, headers: {} };
  await handler({ method: 'GET', url: `/api/player?${query}`, headers: { 'sec-fetch-site': 'same-origin' } }, {
    set statusCode(value) { out.status = value; },
    setHeader(name, value) { out.headers[name] = value; }, end(value) { out.body = JSON.parse(value); },
  });
  return out;
}
function upstream(t, onWeb = () => Response.json(fixture()), onOfficial = () => Response.json(official())) {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push(url);
    const publicWeb = new URL(url).hostname === 'mightpulse.com';
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers['User-Agent'], 'kingshot-gongryak-site/1.0 (+https://xn--ob0bx7rdoh9mq.xyz)');
    if (publicWeb) {
      assert.deepEqual(Object.keys(options.headers).sort(), ['Accept', 'User-Agent']);
      assert.equal(options.method, undefined);
      return onWeb(url, options);
    }
    assert.equal(options.headers.Authorization, 'Bearer synthetic-key');
    return onOfficial(url, options);
  });
  return calls;
}

test('normalization maps hero level/stars, normal/exclusive gear, ranks and governor gems; nested allowlist', () => {
  const result = web.normalizeWebPlayer(fixture(), '101', '202', now);
  assert.ok(result);
  assert.equal(result.heroes[0].level, 80);
  assert.equal(result.heroes[0].star, 26);
  assert.equal(result.heroes[0].position, 1);
  assert.equal(result.heroes[0].gear[0].enhancement_level, 60);
  assert.equal(result.heroes[0].gear[0].refine_level, 4);
  assert.equal(result.heroes[0].exclusive_gear.id, 1050012);
  assert.equal(result.heroes[0].exclusive_gear.level, 2);
  assert.equal(result.gov_gear.items[0].strength_level, 7);
  assert.deepEqual(result.gov_gear.items[0].gems, [{ slot: 1, id: 203 }]);
  assert.equal(result.ranks.town_center_rank, 14);
  assert.equal(result.ranks.leaderboards[0].value, 1234);
  assert.doesNotMatch(JSON.stringify(result), /SECRET|rawjson|alliance_members|online|last_login/);
});

test('privacy true discards even populated or malformed governor gear; unknown privacy falls back', () => {
  for (const gear of [fixture().lords_gear, { secret: true }, null]) {
    const result = web.normalizeWebPlayer({ ...fixture(), lords_gear_privacy: true, lords_gear: gear }, '101', undefined, now);
    assert.equal(result.gov_gear.hidden, true);
    assert.deepEqual(result.gov_gear.items, []);
  }
  assert.equal(web.normalizeWebPlayer({ ...fixture(), lords_gear_privacy: undefined }, '101', undefined, now), null);
});

test('populated profiles allow empty optional hero equipment and skills without losing other sections', () => {
  for (const patch of [{ gear_tiles: [] }, { skill_levels: [] }, { gear_tiles: [], skill_levels: [] }]) {
    const data = fixture();
    Object.assign(data.heroes[0], patch);
    const result = web.normalizeWebPlayer(data, '101', '202', now);
    assert.ok(result);
    assert.equal(result.heroes[0].level, 80);
    assert.equal(result.heroes[0].star, 26);
    assert.equal(result.gov_gear.items.length, 1);
    if (patch.gear_tiles) {
      assert.deepEqual(result.heroes[0].gear, []);
      assert.equal(result.heroes[0].exclusive_gear, null);
    }
    if (patch.skill_levels) assert.deepEqual(result.heroes[0].skill_levels, []);
    assert.equal(web.normalizeWebPlayer({ ...data, profile_populated: undefined }, '101', undefined, now), null);
  }
  for (const patch of [{ gear_tiles: null }, { gear_tiles: [{}] }, { skill_levels: undefined }, { skill_levels: [{}] }]) {
    const data = fixture();
    Object.assign(data.heroes[0], patch);
    assert.equal(web.normalizeWebPlayer(data, '101', '202', now), null);
  }
});

test('empty optional hero sections stay on the web fast path', async t => {
  const handler = await setup(t);
  const data = fixture();
  data.heroes[0].gear_tiles = [];
  data.heroes[0].skill_levels = [];
  const calls = upstream(t, () => Response.json(data));
  const result = await request(handler);
  assert.equal(result.body.source, 'web');
  assert.equal(calls.length, 1);
});

test('timestamps use oldest source snapshot; missing or future source time remains unknown', () => {
  const result = web.normalizeWebPlayer(fixture(), '101', undefined, now);
  assert.equal(result.cached_at, now / 1000 - 180);
  assert.equal(result.age_seconds, 180);
  assert.equal(result.fresh, false);
  for (const stamp of [null, undefined, now / 1000 + 60, '2026-01-01', 0]) {
    const unknown = web.normalizeWebPlayer({ ...fixture(), arena_updated_at: stamp }, '101', undefined, now);
    assert.equal(unknown.cached_at, null);
    assert.equal(unknown.age_seconds, null);
  }
});

test('web succeeds without official key, caches 60s, aliases verified FID and grows source age', async t => {
  const handler = await setup(t, false);
  t.mock.timers.enable({ apis: ['Date'], now });
  const calls = upstream(t);
  const result = await request(handler);
  assert.equal(result.body.source, 'web');
  assert.equal(result.headers['Cache-Control'], 'public, max-age=0, s-maxage=60');
  t.mock.timers.tick(30_000);
  const alias = await request(handler, 'id=202');
  assert.equal(alias.body.age_seconds, 210);
  assert.equal(calls.length, 1);
  t.mock.timers.tick(30_000);
  await request(handler);
  assert.equal(calls.length, 2);
});

test('403, HTML, malformed JSON, wrong identity and incomplete shapes all fall back without auth on web', async t => {
  const bad = [
    () => new Response('private body', { status: 403 }),
    () => new Response('<html>challenge</html>', { headers: { 'Content-Type': 'text/html' } }),
    () => new Response('{broken', { headers: { 'Content-Type': 'application/json' } }),
    ...[{ uid: 999 }, { fid: 999 }, { governor_id: 999 }, { heroes: [] }, { heroes: [{}] },
      { lords_gear: [] }, { lords_gear: [{}] }, { nick_name: {} }, { profile_populated: false },
      { heroes: [{ ...fixture().heroes[0], gear_tiles: null }] },
    ].map(patch => () => Response.json({ ...fixture(), ...patch })),
  ];
  for (const response of bad) {
    const handler = await setup(t);
    const calls = upstream(t, response);
    const result = await request(handler);
    assert.equal(result.status, 200);
    assert.equal(result.body.source, 'official');
    assert.equal(calls.length, 2);
    t.mock.restoreAll();
  }
});

test('FID requires exact unique search identity and matching detail; never treats equal UID as FID', async t => {
  for (const results of [[{ uid: 101, fid: 202 }], [{ uid: 202, fid: 999 }],
    [{ uid: 101, fid: 202 }, { uid: 303, fid: 202 }], [{ uid: 101 }]]) {
    const handler = await setup(t);
    const calls = upstream(t, url => url.includes('/api/search?') ? Response.json({ results }) : Response.json(fixture()));
    const result = await request(handler, 'id=202');
    assert.equal(calls[0], 'https://mightpulse.com/api/search?q=202&live=0');
    assert.equal(result.body.source, results.length === 1 && results[0].fid === 202 ? 'web' : 'official');
    t.mock.restoreAll();
  }
});

test('web timeout includes body and FID search within 5s; official timeout keeps total at 100s', async t => {
  const handler = await setup(t);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let webSignal, officialSignal;
  upstream(t, (_, options) => {
    webSignal = options.signal;
    return { ok: true, headers: new Headers({ 'Content-Type': 'application/json' }), json: () => new Promise(() => {}) };
  }, (_, options) => { officialSignal = options.signal; return new Promise(() => {}); });
  const pending = request(handler, 'id=202');
  await flush();
  t.mock.timers.tick(5_000);
  await flush();
  assert.equal(webSignal.aborted, true);
  assert.equal(officialSignal.aborted, false);
  t.mock.timers.tick(95_000);
  const result = await pending;
  assert.equal(result.status, 504);
  assert.equal(officialSignal.aborted, true);
});

test('refresh skips web and cache, is no-store, and replaces verified aliases with 5min official result', async t => {
  const handler = await setup(t);
  t.mock.timers.enable({ apis: ['Date'], now });
  const calls = upstream(t);
  await request(handler);
  const result = await request(handler, 'id=101&id_type=uid&refresh=1');
  assert.equal(result.body.source, 'official');
  assert.equal(result.headers['Cache-Control'], 'no-store');
  assert.equal(calls.length, 2);
  const cached = await request(handler, 'id=202');
  assert.equal(cached.body.source, 'official');
  assert.match(cached.headers['Cache-Control'], /s-maxage=300/);
  assert.equal(calls.length, 2);
});

test('refresh never joins ordinary work; late ordinary result cannot overwrite refreshed alias', async t => {
  const handler = await setup(t);
  let finishWeb;
  const calls = upstream(t, () => new Promise(resolve => { finishWeb = resolve; }));
  const ordinary = request(handler);
  await flush();
  const refreshed = await request(handler, 'id=101&id_type=uid&refresh=1');
  assert.equal(refreshed.body.source, 'official');
  finishWeb(Response.json(fixture()));
  await ordinary;
  assert.equal((await request(handler, 'id=202')).body.source, 'official');
  assert.equal(calls.length, 2);
});

test('refresh wins even if ordinary request started later and finished earlier', async t => {
  const handler = await setup(t);
  let finishOfficial;
  upstream(t, undefined, () => new Promise(resolve => { finishOfficial = resolve; }));
  const refreshing = request(handler, 'id=101&id_type=uid&refresh=1');
  await flush();
  assert.equal((await request(handler)).body.source, 'web');
  finishOfficial(Response.json(official()));
  await refreshing;
  assert.equal((await request(handler, 'id=202')).body.source, 'official');
});

test('refresh validates option, official identity, and key only when needed; failed refresh retains good web cache', async t => {
  const handler = await setup(t);
  const calls = upstream(t, undefined, () => Response.json({ ...official(), uid: 999 }));
  for (const suffix of ['refresh=0', 'refresh=true', 'refresh=1&refresh=1', 'refresh=']) {
    assert.equal((await request(handler, `id=101&id_type=uid&${suffix}`)).body.error, 'invalid_refresh');
  }
  assert.equal(calls.length, 0);
  await request(handler);
  assert.equal((await request(handler, 'id=101&id_type=uid&refresh=1')).status, 502);
  assert.equal((await request(handler)).body.source, 'web');
  delete process.env.MIGHTPULSE_API_KEY;
  assert.equal((await request(handler, 'id=101&id_type=uid&refresh=1')).status, 503);
  assert.equal(calls.length, 2);
});
