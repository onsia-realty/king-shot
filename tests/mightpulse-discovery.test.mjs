import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { get } from 'node:http';
import ts from 'typescript';

let serial = 0;
const compile = async path => ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const moduleURL = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}#${serial++}`;
const driver = moduleURL('export const neon = url => ({ query: (...args) => globalThis.kingdomQuery(url, ...args) });');
const rawSources = Object.fromEntries(await Promise.all(['search', 'map', 'map-refresh'].map(async name => [name,
  await readFile(new URL(`../api/${name}.ts`, import.meta.url), 'utf8')])));
const storeSource = (await compile('../src/lib/server/kingdom-store.ts')).replace('@neondatabase/serverless', driver);
const { SQL } = await import(moduleURL(storeSource.replace('./mightpulse-discovery.js', moduleURL((await compile('../src/lib/server/mightpulse-discovery.ts'))
  .replace('./same-site.js', moduleURL(await compile('../src/lib/server/same-site.ts')))))));

test('handlers use explicit .js shared imports for Node ESM deployment', () => {
  for (const [name, source] of Object.entries(rawSources)) {
    const file = ts.createSourceFile(`${name}.ts`, source, ts.ScriptTarget.Latest, true);
    const imports = file.statements.filter(ts.isImportDeclaration).map(statement => statement.moduleSpecifier.text);
    assert.ok(imports.every(path => path.startsWith('../src/lib/server/') && path.endsWith('.js')), name);
    if (name === 'map-refresh') assert.doesNotMatch(source, /mightpulse\.com|fetch\(/);
  }
});
async function handlers() {
  // 핸들러마다 새 같은 사이트 검사 모듈을 물려 요청 수 제한 카운터가 테스트끼리 섞이지 않게 한다.
  const guard = moduleURL(await compile('../src/lib/server/same-site.ts'));
  const shared = moduleURL((await compile('../src/lib/server/mightpulse-discovery.ts')).replace('./same-site.js', guard));
  const store = moduleURL(storeSource.replace('./mightpulse-discovery.js', shared));
  const map = moduleURL((await compile('../src/lib/server/mightpulse-map.ts')).replace('./mightpulse-discovery.js', shared)
    .replace('./kingdom-store.js', store));
  return async name => {
    const source = (await compile(`../api/${name}.ts`)).replace('../src/lib/server/mightpulse-discovery.js', shared)
      .replace('../src/lib/server/kingdom-store.js', store).replace('../src/lib/server/mightpulse-map.js', map);
    return (await import(moduleURL(source))).default;
  };
}
async function handler(name) { return (await handlers())(name); }
// Legacy store cases exercise recovery deterministically, without network access.
test.beforeEach(t => { t.mock.method(globalThis, 'fetch', async () => new Response('<html>challenge secret</html>', { status: 403 })); });
async function request(handler, url, method = 'GET') {
  const headers = {};
  let body;
  const res = { statusCode: 200, setHeader(name, value) { headers[name] = value; }, end(value) { body = JSON.parse(value); } };
  await handler({ url, method, headers: { 'sec-fetch-site': 'same-origin', cookie: 'secret' } }, res);
  return { status: res.statusCode, headers, body };
}
function error(result, status, code) {
  assert.equal(result.status, status);
  assert.deepEqual(Object.keys(result.body).sort(), ['error', 'message', 'ok']);
  assert.equal(result.body.ok, false);
  assert.equal(result.body.error, code);
  assert.match(result.body.message, /[가-힣]/);
  assert.equal(result.headers['Cache-Control'], 'no-store');
  assert.doesNotMatch(JSON.stringify(result.body), /secret|<html/);
}
// Stubbed Neon driver: `tables` maps a statement name from SQL to rows, a function of params, or an Error.
function db(t, tables = {}, url = 'postgresql://test:secret@db.example/db') {
  for (const [key, value] of Object.entries({ DATABASE_URL: url, POSTGRES_URL: '' })) {
    const previous = process.env[key]; process.env[key] = value;
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  }
  t.after(() => { delete globalThis.kingdomQuery; });
  const calls = [];
  globalThis.kingdomQuery = async (connection, sql, params, options) => {
    assert.equal(connection, url);
    assert.ok(options.fetchOptions.signal instanceof AbortSignal);
    const name = Object.keys(SQL).find(key => SQL[key] === sql);
    assert.ok(name, `unknown statement: ${sql.slice(0, 60)}`);
    calls.push([name, params]);
    const rows = tables[name];
    if (rows instanceof Error) throw rows;
    return typeof rows === 'function' ? rows(params) : rows ?? [];
  };
  return calls;
}
const queued = (over = {}) => ({ located: 0, total: 0, collected_at: null, queue_position: '3', roster: false, ...over });
const collected = queued({ located: 2, total: 3, collected_at: 1_700_000_000.5, queue_position: null, roster: true });
const cityRow = { uid: '60611017', nick_name: 'Zeras', power: '98151218', tc: 38, aid: '123', alliance_abbr: 'ABC',
  kid: 1622, profile_kid: 1622, profile_cached_at: 1_699_000_000,
  x: 0, y: 641, shield_endtime: 2_000_000_000, burn_endtime: 0, located_at: 1_699_999_000, secret: 'row' };
const allianceRow = { aid: '123', abbr: 'ABC', name: 'Alliance', power: '200', city_count: '2', cx: '0', cy: '641', secret: 'row' };
const searchRow = { uid: '60611017', governor_id: '241496933', nick_name: 'Zeras', kid: 1622, power: '100', tc: 30,
  x: 0, y: 641, alliance_abbr: 'ABC', alliance_name: 'Alliance', avatar_url: '/assets/avatar.png', secret: 'row' };
const notCollected = kid => ({ ok: false, error: 'not_collected', kid, queued: true,
  message: '이 왕국은 아직 수집되지 않았습니다. 수집 대기열에 등록했으니 잠시 후 다시 조회해 주세요.' });

const upstream = (kid = 1622, over = {}) => ({ ok: true, kid, bounds: { min: 0, max: 1200 },
  cities: [{ uid: 60611017, nick_name: 'Zeras', power: 100, stove_lv: 30, tc: 30,
    kid, map_kid: kid, aid: 123, alliance_abbr: 'ABC', x: 0, y: 1200,
    shield_active: true, burn_active: false, city_skin_icon: '/assets/city.png', secret: 'private' }],
  alliances: [{ aid: 123, abbr: 'ABC', name: 'Alliance', city_count: 1, cx: 0, cy: 1200, power_sum: 100 }],
  stats: { location_updated_at: 1_700_000_000 }, secret: 'private', ...over });
const flush = () => new Promise(resolve => setImmediate(resolve));

test('public map 200 uses fixed identifiable headers, needs no DB/key, and shares its snapshot with scoped search', async t => {
  const calls = db(t, {}, '');
  const modules = await handlers(), map = await modules('map'), search = await modules('search');
  const fetch = t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://mightpulse.com/api/map?kid=1622&layers=cities&limit=50000');
    assert.deepEqual(options.headers, { 'User-Agent': 'kingshot-gongryak-site/1.0 (+https://xn--ob0bx7rdoh9mq.xyz)', Accept: 'application/json' });
    assert.equal(options.redirect, 'error'); assert.ok(options.signal instanceof AbortSignal);
    return Response.json(upstream());
  });
  const result = await request(map, '/api/map?kid=01622&layers=evil&limit=1&host=evil&key=secret');
  assert.equal(result.status, 200);
  assert.deepEqual(Object.keys(result.body).sort(), ['alliances', 'bounds', 'cities', 'kid', 'ok', 'partial', 'source', 'stale', 'updated_at']);
  assert.equal(result.body.source, 'mightpulse'); assert.equal(result.body.partial, false); assert.equal(result.body.stale, false);
  assert.equal(result.body.updated_at, 1_700_000_000);
  assert.equal(result.body.cities[0].city_skin_icon, 'https://mightpulse.com/assets/city.png');
  assert.equal(result.headers['Cache-Control'], 'public, max-age=0, s-maxage=60');
  assert.doesNotMatch(JSON.stringify(result.body), /secret|private/);
  const found = await request(search, '/api/search?q=zErA&kid=1622');
  assert.deepEqual(found.body.results[0], { uid: 60611017, fid: null, nick_name: 'Zeras', kid: 1622, map_kid: 1622,
    power: 100, town_center_level: 30, x: 0, y: 1200, alliance_abbr: 'ABC', alliance_name: 'Alliance', avatar_url: null });
  assert.equal(found.body.total, 1); assert.equal(found.body.query, 'zErA');
  assert.equal(found.body.stale, false); assert.equal(found.body.partial, false);
  assert.equal((await request(search, '/api/search?q=notfound&kid=1622')).body.total, 0);
  assert.equal(fetch.mock.callCount(), 1); assert.deepEqual(calls, []);
});

test('current map kingdom permits visitors; invalid coordinates, wrong locations, duplicate IDs and unsafe skins are excluded', async t => {
  db(t, {}, '');
  const row = upstream().cities[0];
  const cities = [row, { ...row, uid: 2, kid: 1601, x: 1200, y: 0, city_skin_icon: 'https://evil.test/assets/a.png' },
    { ...row, uid: 3, map_kid: 1601 }, { ...row, uid: 4, x: -1 }, { ...row, uid: 5, y: 1201 },
    { ...row, uid: 6, x: '1' }, { ...row, uid: 7, y: null }, { ...row, uid: 0 },
    { ...row, uid: 8, map_kid: null, city_skin_icon: 'javascript:alert(1)' }, { ...row, uid: 2 },
    { ...row, uid: 9, map_kid: '1622' }];
  t.mock.method(globalThis, 'fetch', async () => Response.json(upstream(1622, { cities })));
  const result = await request(await handler('map'), '/api/map?kid=1622');
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.cities.map(row => row.uid), [60611017, 2, 8]);
  assert.equal(result.body.cities[1].kid, 1601); assert.equal(result.body.cities[1].map_kid, 1622);
  assert.equal(result.body.cities[1].city_skin_icon, null); assert.equal(result.body.cities[2].city_skin_icon, null);
  assert.equal(result.body.partial, true);
});

test('challenge after success keeps previous upstream snapshot for map/search and cools down even fresh requests', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: 1_000_000 });
  const calls = db(t, {}, '');
  const modules = await handlers(), map = await modules('map'), search = await modules('search');
  let challenge = false;
  const fetch = t.mock.method(globalThis, 'fetch', async () => challenge
    ? { ok: false, status: 403, json() { assert.fail('must not read challenge body'); } } : Response.json(upstream()));
  const before = await request(map, '/api/map?kid=1622');
  challenge = true;
  const fallback = await request(map, '/api/map?kid=1622&fresh=1');
  assert.equal(fallback.status, 200); assert.equal(fallback.body.stale, true); assert.equal(fallback.body.partial, false);
  assert.deepEqual(fallback.body.cities, before.body.cities);
  assert.equal(fallback.body.updated_at, before.body.updated_at); assert.equal(fallback.headers['Cache-Control'], 'no-store');
  assert.equal((await request(search, '/api/search?q=Zeras&kid=1622')).body.stale, true);
  await request(map, '/api/map?kid=1622&fresh=1');
  assert.equal(fetch.mock.callCount(), 2); assert.deepEqual(calls, []);
  t.mock.timers.tick(30_000); challenge = false;
  // Even though the old snapshot is younger than 60s, recovery must verify it again.
  assert.equal((await request(map, '/api/map?kid=1622')).body.stale, false);
  assert.equal(fetch.mock.callCount(), 3);
});

test('bad payloads and successful HTML use DB fallback without cache poisoning or error body leakage', async t => {
  const calls = db(t, { status: [collected], cities: [cityRow], alliances: [] });
  for (const payload of [null, { ok: false, message: '<html>secret</html>' }, upstream(9999),
    upstream(1622, { bounds: { min: 0, max: 999999 } }), upstream(1622, { cities: {} }),
    upstream(1622, { cities: [{ uid: 1, kid: 1622, x: -1, y: 1 }] }), upstream(1622, { alliances: null })]) {
    const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json(payload));
    const result = await request(await handler('map'), '/api/map?kid=1622');
    assert.equal(result.status, 200); assert.equal(result.body.source, 'official_profiles');
    assert.equal(result.body.stale, true); assert.equal(result.body.partial, true);
    assert.doesNotMatch(JSON.stringify(result.body), /secret|<html/);
    fetch.mock.restore();
  }
  for (const response of [new Response('<html>secret</html>', { headers: { 'content-type': 'text/html' } }),
    new Response('broken secret json', { headers: { 'content-type': 'application/json' } })]) {
    const fetch = t.mock.method(globalThis, 'fetch', async () => response);
    assert.equal((await request(await handler('map'), '/api/map?kid=1622')).body.source, 'official_profiles');
    fetch.mock.restore();
  }
  assert.ok(calls.length > 0);
});

test('malformed refresh cannot replace an already valid upstream snapshot', async t => {
  db(t, {}, '');
  let payload = upstream();
  t.mock.method(globalThis, 'fetch', async () => Response.json(payload));
  const map = await handler('map');
  const before = await request(map, '/api/map?kid=1622');
  payload = upstream(1622, { cities: [{ uid: 1, x: null }] });
  const after = await request(map, '/api/map?kid=1622&fresh=1');
  assert.equal(after.status, 200); assert.equal(after.body.stale, true);
  assert.deepEqual(after.body.cities, before.body.cities);
});

test('timeout includes response body, aborts once, falls back to DB and does not retry during cooldown', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 1_000_000 });
  db(t, { status: [collected], cities: [cityRow] });
  let signal;
  const fetch = t.mock.method(globalThis, 'fetch', async (_, options) => {
    signal = options.signal;
    return { ok: true, headers: new Headers({ 'content-type': 'application/json' }), json: () => new Promise(() => {}) };
  });
  const map = await handler('map');
  const work = request(map, '/api/map?kid=1622');
  await flush(); t.mock.timers.tick(10_000);
  const result = await work;
  assert.equal(signal.aborted, true); assert.equal(result.status, 200); assert.equal(result.body.stale, true);
  await request(map, '/api/map?kid=1622&fresh=1');
  assert.equal(fetch.mock.callCount(), 1);
});

test('ordinary/fresh/map/search requests deduplicate; refresh replaces normal cache and expiry re-fetches saved data', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: 1_000_000 });
  db(t, {}, '');
  const modules = await handlers(), map = await modules('map'), search = await modules('search');
  let finish;
  const fetch = t.mock.method(globalThis, 'fetch', () => new Promise(resolve => { finish = resolve; }));
  const first = request(map, '/api/map?kid=1622'), fresh = request(map, '/api/map?kid=1622&fresh=1');
  const scoped = request(search, '/api/search?q=Zeras&kid=1622');
  assert.equal(fetch.mock.callCount(), 1); finish(Response.json(upstream()));
  assert.equal((await first).status, 200); assert.equal((await fresh).headers['Cache-Control'], 'no-store');
  assert.equal((await scoped).body.total, 1);
  t.mock.timers.tick(20_000);
  assert.equal((await request(map, '/api/map?kid=1622')).headers['Cache-Control'], 'public, max-age=0, s-maxage=40');
  const refresh = request(map, '/api/map?kid=1622&fresh=1');
  assert.equal(fetch.mock.callCount(), 2); finish(Response.json(upstream(1622, { stats: { location_updated_at: 200 } })));
  assert.equal((await refresh).body.updated_at, 200);
  assert.equal((await request(map, '/api/map?kid=1622')).body.updated_at, 200);
  t.mock.timers.tick(60_000);
  const expired = request(map, '/api/map?kid=1622');
  assert.equal(fetch.mock.callCount(), 3); finish(Response.json(upstream())); await expired;
});

test('map cache is bounded to ten kingdoms and previous good snapshots expire after one hour', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: 1_000_000 });
  db(t, { status: [queued()] });
  let blocked = false;
  const fetch = t.mock.method(globalThis, 'fetch', async url => blocked ? new Response('', { status: 403 })
    : Response.json(upstream(Number(new URL(url).searchParams.get('kid')))));
  const map = await handler('map');
  for (let kid = 1; kid <= 11; kid++) assert.equal((await request(map, `/api/map?kid=${kid}`)).status, 200);
  await request(map, '/api/map?kid=11'); assert.equal(fetch.mock.callCount(), 11);
  await request(map, '/api/map?kid=1'); assert.equal(fetch.mock.callCount(), 12);
  blocked = true; t.mock.timers.tick(3_600_000);
  assert.equal((await request(map, '/api/map?kid=1')).status, 202);
});

test('global public search uses original endpoint, normalizes safely, caches, then marks stale on challenge', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: 1_000_000 });
  const calls = db(t, {}, '');
  let blocked = false;
  const fetch = t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://mightpulse.com/api/search?q=ze%20ras&live=0');
    assert.equal(options.headers.Accept, 'application/json'); assert.equal(Object.keys(options.headers).length, 2);
    return blocked ? new Response('secret', { status: 403 }) : Response.json({ ok: true, secret: 'private', results: [
      { uid: '60611017', fid: '241496933', nick_name: 'Zeras', kid: 1622, town_center_level: 30,
        x: -1, y: 1201, avatar_url: 'https://evil.test/a.png', private: true }] });
  });
  const search = await handler('search');
  const result = await request(search, '/api/search?q=ze%20ras&live=1&key=secret');
  assert.equal(result.status, 200); assert.equal(result.body.stale, false); assert.equal(result.body.partial, false);
  assert.equal(result.body.results[0].fid, '241496933');
  assert.equal(result.body.results[0].x, null); assert.equal(result.body.results[0].y, null); assert.equal(result.body.results[0].avatar_url, null);
  assert.doesNotMatch(JSON.stringify(result.body), /secret|private|evil/);
  await request(search, '/api/search?q=ze%20ras'); assert.equal(fetch.mock.callCount(), 1);
  blocked = true; t.mock.timers.tick(60_000);
  const stale = await request(search, '/api/search?q=ze%20ras');
  assert.equal(stale.body.stale, true); assert.equal(stale.headers['Cache-Control'], 'no-store');
  assert.deepEqual(stale.body.results, result.body.results); assert.deepEqual(calls, []);
});

test('global search malformed responses fall back to DB; concurrent fallback requests deduplicate and cache briefly', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: 1_000_000 });
  let finish;
  const calls = db(t, { search: () => new Promise(resolve => { finish = resolve; }) });
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json({ ok: true, results: [{ secret: 'invalid row' }] }));
  const search = await handler('search');
  const first = request(search, '/api/search?q=Zeras'), second = request(search, '/api/search?q=Zeras');
  await flush(); assert.equal(fetch.mock.callCount(), 1); assert.equal(calls.length, 1);
  finish([searchRow]);
  const result = await first;
  assert.deepEqual((await second).body, result.body);
  assert.equal(result.body.source, 'official_profiles'); assert.equal(result.body.partial, true); assert.equal(result.body.stale, true);
  await request(search, '/api/search?q=Zeras'); assert.equal(calls.length, 1);
  t.mock.timers.tick(30_000);
  const next = request(search, '/api/search?q=Zeras'); await flush();
  assert.equal(fetch.mock.callCount(), 2); assert.equal(calls.length, 2);
  finish([searchRow]); await next;
});

test('methods, bounded queries and kingdoms reject before any query', async t => {
  const calls = db(t);
  const search = await handler('search'), map = await handler('map');
  for (const h of [search, map]) {
    for (const method of ['POST', 'PUT', 'HEAD', 'OPTIONS']) {
      const result = await request(h, '/api/search?q=Zeras&kid=1622', method);
      error(result, 405, 'invalid_method');
      assert.equal(result.headers.Allow, 'GET');
    }
  }
  for (const query of ['', '?q=', '?q=a', '?q=%20a%20', '?q=aa&q=bb', '?q=ab%00', `?q=${'a'.repeat(81)}`]) {
    error(await request(search, `/api/search${query}`), 400, 'invalid_query');
  }
  for (const kid of ['', '0', '10001', '-1', '1.2', '1e3', 'NaN', 'https://evil.test', '1&kid=2']) {
    error(await request(search, `/api/search?q=Zeras&kid=${kid}`), 400, 'invalid_kid');
    error(await request(map, `/api/map?kid=${kid}`), 400, 'invalid_kid');
  }
  error(await request(map, '/api/map'), 400, 'invalid_kid');
  assert.deepEqual(calls, []);
});

test('an empty kingdom is registered and answered 202 after checking for partial cities', async t => {
  const calls = db(t, { status: [queued()] });
  const map = await handler('map'), search = await handler('search');
  for (const [h, url] of [[map, '/api/map?kid=01622'], [search, '/api/search?q=Zeras&kid=1622']]) {
    const result = await request(h, url);
    assert.equal(result.status, 202);
    assert.deepEqual(result.body, notCollected(1622));
    assert.equal(result.headers['Cache-Control'], 'no-store');
  }
  // Nothing is cached for a queued kingdom, so the next visit sees the collection as soon as it lands.
  await request(map, '/api/map?kid=1622');
  assert.deepEqual(calls.map(([name]) => name), ['status', 'cities', 'alliances', 'status', 'cities', 'alliances', 'status', 'cities', 'alliances']);
});

test('partial stored map preserves profile time and never invents map kingdom or shield/burn flags', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: 1_800_000_000_000 });
  const calls = db(t, { status: [collected], alliances: [allianceRow, { aid: '9' }], cities: [cityRow,
    { ...cityRow, uid: 60611018, located_at: '1700000000', shield_endtime: null, burn_endtime: 1_900_000_000, power: null, aid: null }] });
  const result = await request(await handler('map'), '/api/map?kid=1622&layers=camp&limit=1');
  assert.equal(result.status, 200);
  assert.equal(result.headers['Cache-Control'], 'no-store');
  assert.deepEqual(Object.keys(result.body).sort(), ['alliances', 'bounds', 'cities', 'coverage', 'kid', 'ok', 'partial', 'source', 'stale', 'updated_at']);
  assert.equal(result.body.source, 'official_profiles'); assert.equal(result.body.partial, true); assert.equal(result.body.stale, true);
  assert.deepEqual(result.body.bounds, { min: 0, max: 1200 });
  assert.deepEqual(result.body.coverage, { located: 2, total: 3, collected_at: 1_700_000_000.5 });
  assert.equal(result.body.updated_at, 1_700_000_000);
  assert.deepEqual(result.body.cities[0], { uid: '60611017', nick_name: 'Zeras', power: 98151218, tc: 38, stove_lv: null,
    kid: 1622, map_kid: null, aid: '123', alliance_abbr: 'ABC', x: 0, y: 641, shield_active: null, burn_active: null, city_skin_icon: null,
    profile_cached_at: 1_699_000_000 });
  const second = result.body.cities[1];
  assert.equal(second.uid, '60611018'); assert.equal(second.power, null); assert.equal(second.aid, null);
  assert.equal(second.shield_active, null); assert.equal(second.burn_active, null);
  assert.deepEqual(result.body.alliances, [
    { aid: '123', abbr: 'ABC', name: 'Alliance', city_count: 2, cx: 0, cy: 641, power_sum: 200, flag_url: null },
    { aid: '9', abbr: null, name: null, city_count: null, cx: null, cy: null, power_sum: null, flag_url: null }]);
  assert.doesNotMatch(JSON.stringify(result.body), /secret|endtime|located_at|governor/);
  assert.deepEqual(calls, [['status', [1622]], ['cities', [1622]], ['alliances', [1622]]]);
});

test('unfinished rosters expose valid partial cities; invalid coordinates, UIDs and war kingdoms are filtered', async t => {
  db(t, { status: [queued({ total: 9, roster: true })], cities: [cityRow,
    { ...cityRow, uid: '0' }, { ...cityRow, uid: 'not-a-uid' }, { ...cityRow, uid: '9223372036854775808' },
    { ...cityRow, uid: '2', x: null }, { ...cityRow, uid: '3', x: 1201 },
    { ...cityRow, uid: '4', y: Infinity }, { ...cityRow, uid: '5', profile_kid: 9999 },
    { ...cityRow, uid: '6', x: '   ' }, { ...cityRow, uid: '7', kid: 9999 }] });
  const result = await request(await handler('map'), '/api/map?kid=1622');
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.cities.map(p => p.uid), ['60611017']);
  assert.deepEqual(result.body.coverage, { located: 1, total: 9, collected_at: null });
  assert.equal(result.body.partial, true);
  assert.equal(result.body.cities[0].x, 0);
});

test('known roster without locations returns an empty partial map, not a hidden pending map', async t => {
  db(t, { status: [queued({ total: 90, roster: true })] });
  const result = await request(await handler('map'), '/api/map?kid=1622');
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.cities, []);
  assert.deepEqual(result.body.coverage, { located: 0, total: 90, collected_at: null });
});

test('source time is distinct from collection time and missing source time stays unknown', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: 1_800_000_000_000 });
  db(t, { status: [collected], cities: [{ ...cityRow, located_at: 1_800_000_000, profile_cached_at: null }] });
  const result = await request(await handler('map'), '/api/map?kid=1622');
  assert.equal(result.body.updated_at, 1_800_000_000);
  assert.equal(result.body.cities[0].profile_cached_at, null);
  assert.equal(result.body.stale, true);
});

test('coverage SQL counts real known roster rows and valid positions instead of request counters', () => {
  for (const sql of [SQL.status, SQL.request]) {
    assert.match(sql, /SELECT count\(\*\) FROM public\.players p WHERE p\.kid=r\.kid AND p\.uid>0/);
    assert.match(sql, /p\.profile_kid = p\.kid/);
    assert.doesNotMatch(sql, /SELECT r\.located, r\.total/);
  }
});

test('DB fallback cache lasts 30 seconds per kingdom; fresh bypasses it without a collection request', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: 1_000_000 });
  let located = 100;
  const calls = db(t, { status: [collected], alliances: [], cities: ([kid]) => [{ ...cityRow, kid, profile_kid: kid, located_at: located }] });
  const map = await handler('map');
  assert.equal((await request(map, '/api/map?kid=1622')).body.updated_at, 100);
  located = 200;
  t.mock.timers.tick(10_000);
  const cached = await request(map, '/api/map?kid=1622');
  assert.equal(cached.body.updated_at, 100); assert.equal(cached.headers['Cache-Control'], 'no-store');
  assert.equal(calls.length, 3);
  const fresh = await request(map, '/api/map?kid=1622&fresh=1');
  assert.equal(fresh.body.updated_at, 200); assert.equal(fresh.headers['Cache-Control'], 'no-store');
  assert.equal(calls.length, 6);
  located = 300;
  assert.equal((await request(map, '/api/map?kid=1622')).body.updated_at, 200);
  assert.equal((await request(map, '/api/map?kid=1623')).body.updated_at, 300);
  t.mock.timers.tick(30_000);
  assert.equal((await request(map, '/api/map?kid=1622')).body.updated_at, 300);
  assert.equal(calls.length, 12);
});

test('global DB search escapes LIKE wildcards; scoped fallback searches the same stored city snapshot', async t => {
  const calls = db(t, { status: [collected], cities: [cityRow], search: [searchRow, { ...searchRow, governor_id: null, uid: 7, power: '5' }] });
  const search = await handler('search');
  const query = 'Ze%_\\x';
  const global = await request(search, `/api/search?q=${encodeURIComponent(` ${query} `)}&live=1`);
  assert.equal(global.status, 200);
  assert.equal(global.headers['Cache-Control'], 'no-store');
  assert.deepEqual(Object.keys(global.body).sort(), ['ok', 'partial', 'query', 'results', 'source', 'stale', 'total']);
  assert.equal(global.body.stale, true); assert.equal(global.body.partial, true);
  assert.equal(global.body.query, query); assert.equal(global.body.total, 2);
  assert.deepEqual(global.body.results[0], { uid: '60611017', fid: '241496933', nick_name: 'Zeras', kid: 1622, power: 100,
    town_center_level: 30, x: 0, y: 641, alliance_abbr: 'ABC', alliance_name: 'Alliance', avatar_url: 'https://mightpulse.com/assets/avatar.png' });
  assert.equal(global.body.results[1].fid, null); assert.equal(global.body.results[1].uid, 7);
  assert.doesNotMatch(JSON.stringify(global.body), /secret|governor_id/);
  const scoped = await request(search, `/api/search?q=ZeRa&kid=01622`);
  assert.equal(scoped.body.query, 'ZeRa'); assert.equal(scoped.body.results[0].kid, 1622);
  assert.equal(scoped.body.stale, true); assert.equal(scoped.body.partial, true);
  assert.deepEqual(calls, [['search', ['%ze\\%\\_\\\\x%', null]], ['status', [1622]], ['cities', [1622]], ['alliances', [1622]]]);
});

test('missing connection string, driver failures and malformed rows become 503 without leaking', async t => {
  const calls = db(t, {}, '');
  for (const [name, url] of [['map', '/api/map?kid=1622'], ['search', '/api/search?q=Zeras']]) {
    error(await request(await handler(name), url), 503, 'storage_unavailable');
  }
  assert.deepEqual(calls, []);
  process.env.DATABASE_URL = 'postgresql://test:secret@db.example/db';
  const map = await handler('map');
  for (const status of [new Error('secret failure'), [], [queued(), queued()]]) {
    db(t, { status });
    error(await request(map, '/api/map?kid=1622'), 503, 'storage_unavailable');
  }
  db(t, { status: [collected], cities: new Error('secret failure') });
  error(await request(map, '/api/map?kid=1622'), 503, 'storage_unavailable');
  // A failure is never cached as a map.
  db(t, { status: [collected], cities: [cityRow], alliances: [] });
  assert.equal((await request(map, '/api/map?kid=1622')).body.cities.length, 1);
});

test('in-flight requests beyond the handler limit are refused with 429', async t => {
  const release = [];
  db(t, { status: () => new Promise(resolve => release.push(resolve)) });
  const map = await handler('map');
  const pending = Array.from({ length: 10 }, (_, i) => request(map, `/api/map?kid=${i + 1}`));
  error(await request(map, '/api/map?kid=9999'), 429, 'rate_limited');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(release.length, 10);
  for (const resolve of release) resolve([queued()]);
  for (const result of await Promise.all(pending)) assert.equal(result.status, 202);
  // Finished requests free their slot.
  db(t, { status: [queued()] });
  assert.equal((await request(map, '/api/map?kid=9999')).status, 202);
});

test('SQL only reads and upserts request rows; filters, limits and ordering are fixed in the statement', () => {
  for (const statement of Object.values(SQL)) assert.doesNotMatch(statement, /DROP|DELETE|TRUNCATE|CREATE|ALTER/i);
  for (const name of ['status', 'request']) {
    assert.match(SQL[name], /INSERT INTO public\.kingdom_requests \(kid\) VALUES \(\$1\)/);
    assert.match(SQL[name], /ON CONFLICT \(kid\) DO UPDATE/);
    assert.match(SQL[name], /collected_at IS NULL AND q\.kid <> r\.kid AND q\.requested_at <= r\.requested_at/);
  }
  assert.doesNotMatch(SQL.status, /request_count|now\(\)/);
  assert.match(SQL.request, /request_count = public\.kingdom_requests\.request_count \+ 1/);
  assert.match(SQL.request, /WHEN public\.kingdom_requests\.collected_at IS NULL THEN public\.kingdom_requests\.requested_at ELSE now\(\)/);
  assert.match(SQL.cities, /WHERE kid = \$1 AND p\.uid > 0 AND p\.profile_kid = p\.kid/);
  assert.match(SQL.cities, /p\.x BETWEEN 0 AND 1200 AND p\.y BETWEEN 0 AND 1200/);
  assert.match(SQL.alliances, /p\.kid=a\.kid AND p\.uid > 0 AND p\.profile_kid = p\.kid/);
  assert.match(SQL.search, /lower\(p\.nick_name\) LIKE \$1 AND \(\$2::int IS NULL OR p\.kid = \$2\) ORDER BY p\.power DESC NULLS LAST LIMIT 100$/);
  for (const name of ['cities', 'alliances', 'search']) assert.doesNotMatch(SQL[name], /INSERT|UPDATE/);
});

test('dev middleware routes search/map on both slash variants to the Node handlers', async t => {
  const { createServer } = await import('vite');
  const { default: config } = await import('../astro.config.mjs');
  const plugin = config.vite.plugins.find(item => item.name === 'mightpulse-player-api');
  const server = await createServer({ configFile: false, plugins: [plugin], server: { port: 0, host: '127.0.0.1' }, appType: 'custom' });
  t.after(() => server.close());
  await server.listen();
  const address = server.httpServer.address();
  // Validation answers before any database access, so routing is provable without a connection string.
  for (const [url, code] of [['/api/search?q=a', 'invalid_query'], ['/api/search/?q=a', 'invalid_query'], ['/api/map?kid=0', 'invalid_kid'], ['/api/map/?kid=0', 'invalid_kid']]) {
    const result = await new Promise((resolve, reject) => {
      get(`http://127.0.0.1:${address.port}${url}`, { headers: { 'sec-fetch-site': 'same-origin' } }, res => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
      }).on('error', reject);
    });
    assert.equal(result.status, 400);
    assert.equal(result.body.error, code);
  }
});
