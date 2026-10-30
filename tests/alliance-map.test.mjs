import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setImmediate as flush } from 'node:timers/promises';
import test from 'node:test';
import ts from 'typescript';

let serial = 0;
const moduleURL = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}#${serial++}`;
const compile = async path => ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const serviceURL = moduleURL(await compile('../src/lib/server/official-map.ts'));
const { createOfficialMapService, parseMapQuery, profileCachedAt, realUid } = await import(serviceURL);
const info = { aid: '163100207', abbr: 'ROK', name: 'HaeMil', kid: 1622, member_count: 90 };
const query = (offset = 0, tag = 'ROK', kid = 1622) => ({ kid, tag, offset });
const roster = (ids = [1, 2, 3, 4, 5, 6], tag = 'ROK') => ({
  ok: true, alliance: { ...info, abbr: tag }, members: ids.map(uid => ({ uid, governor_id: 999999 })),
});
const player = (uid, fields = {}, meta = {}) => ({
  ok: true, uid, governor_id: 999999,
  player: { uid, kid: 1622, nick_name: 'Member', x: 432, y: 641, power: 500, town_center_level: 54,
    alliance: info, ...fields },
  cached_at: 1793327540.6692014, ...meta,
});
const list = (kid = 1622) => ({ boards: [{ rows: [{ ...info, kid }] }] });
function harness(reply) {
  let now = 1_800_000_000_000;
  const calls = [];
  const service = createOfficialMapService({
    now: () => now, key: () => '  test-key-only\n',
    fetch: async (url, options) => {
      calls.push(url);
      assert.equal(new URL(url).origin, 'https://api.mightpulse.com');
      assert.equal(options.redirect, 'error');
      assert.deepEqual(options.headers, { Authorization: 'Bearer test-key-only' });
      const result = await reply(url, options);
      return result instanceof Response || typeof result?.json === 'function' ? result : Response.json(result);
    },
  });
  return { service, calls, advance: ms => { now += ms; } };
}
const uidOf = url => new URL(url).pathname.split('/').at(-1);
const profileURL = url => url.includes('/players/');
const rejection = (status, code) => error => error.status === status && error.code === code;

test('query rejects malformed/duplicate IDs, unsafe tags and invalid offsets', () => {
  for (const suffix of ['', 'kid=0', 'kid=-1', 'kid=1.2', 'kid=1e3', 'kid=10001', 'kid=NaN', 'kid=1&kid=2', 'kid=1%0A']) {
    assert.throws(() => parseMapQuery(new URLSearchParams(suffix)), rejection(400, 'invalid_kid'));
  }
  for (const tag of ['', '../ROK', 'ROK/x', 'ROK?', 'A'.repeat(13), 'ROK\n', ' ROK']) {
    assert.throws(() => parseMapQuery(new URLSearchParams({ kid: '1622', tag })), rejection(400, 'invalid_tag'));
  }
  for (const suffix of ['tag=ROK&tag=ABC', 'tag=ROK&offset=-1', 'tag=ROK&offset=1.1', 'tag=ROK&offset=01',
    'tag=ROK&offset=', 'tag=ROK&offset=1001', 'tag=ROK&offset=0&offset=5', 'offset=0']) {
    assert.throws(() => parseMapQuery(new URLSearchParams(`kid=1622&${suffix}`)));
  }
  assert.deepEqual(parseMapQuery(new URLSearchParams('kid=1622&tag=ROK')), query());
  assert.deepEqual(parseMapQuery(new URLSearchParams('kid=1622')), { kid: 1622, offset: 0 });
  assert.equal(realUid('00060611017'), '60611017');
  for (const uid of [0, -1, true, null, '', '1e3', '1.2', Number.MAX_SAFE_INTEGER + 1]) assert.equal(realUid(uid), null);
});

test('provider timestamp parses fractional Unix seconds and ISO, never synthesizes time', () => {
  const actual = 1793327540.6692014;
  assert.equal(profileCachedAt(actual), actual);
  assert.equal(profileCachedAt(String(actual)), actual);
  assert.equal(profileCachedAt('2026-10-14T00:00:00Z'), Date.parse('2026-10-14T00:00:00Z') / 1000);
  assert.equal(profileCachedAt(0), 0);
  for (const value of [undefined, null, false, '', 'yesterday', '2026-10-14', -1, Infinity, Date.now()]) {
    assert.equal(profileCachedAt(value), null);
  }
});

test('alliance list uses the official rank board, filters kingdom and returns an allowlist', async () => {
  const h = harness(url => {
    assert.equal(url, 'https://api.mightpulse.com/v1/kingdoms/1622/ranks?board=alliance_power&limit=100');
    return { boards: [{ rows: [{ ...info, private_field: 'hidden' }, { ...info, aid: 2, kid: 1 },
      { ...info, aid: 3, member_count: null }] }] };
  });
  const result = await h.service({ kid: 1622, offset: 0 });
  assert.deepEqual(result, { ok: true, kind: 'alliances', kid: 1622, alliances: [
    { aid: info.aid, abbr: 'ROK', name: 'HaeMil', member_count: 90 },
    { aid: '3', abbr: 'ROK', name: 'HaeMil', member_count: null },
  ] });
  await h.service({ kid: 1622, offset: 0 });
  assert.equal(h.calls.length, 1);
});

test('batch is capped at five real UIDs; no governor lookup; next_offset covers final short batch', async () => {
  const h = harness(url => profileURL(url) ? player(uidOf(url)) : roster());
  const first = await h.service(query());
  assert.equal(first.processed, 5);
  assert.equal(first.cities.length, 5);
  assert.equal(first.next_offset, 5);
  assert.equal(first.roster_count, 6);
  assert.equal(first.coverage, 'alliance_profiles');
  assert.deepEqual(first.bounds, { min: 0, max: 1200 });
  assert.equal(h.calls[0], 'https://api.mightpulse.com/v1/alliances/1622/ROK?include=info,roster');
  assert.equal(h.calls[1], 'https://api.mightpulse.com/v1/players/1?id_type=uid&include=base');
  assert.equal(h.calls.length, 6);
  assert.equal(first.cities[0].profile_cached_at, 1793327540.6692014);
  assert.equal(first.cities[0].tc, 54);
  assert.equal(first.cities[0].shield_active, null);
  assert.equal(first.cities[0].burn_active, null);
  for (const absent of ['map_kid', 'city_skin_icon', 'stove_lv', 'governor_id', 'cache_ttl_ms']) {
    assert.equal(absent in first.cities[0], false);
  }
  const last = await h.service(query(5));
  assert.equal(last.processed, 1);
  assert.equal(last.next_offset, null);
  assert.equal(h.calls.length, 7);
  const end = await h.service(query(6));
  assert.equal(end.processed, 0);
  assert.equal(end.next_offset, null);
  await assert.rejects(h.service(query(7)), rejection(400, 'invalid_offset'));
});

test('null, missing, blank and invalid coordinates are unlocated; genuine zero is valid', async () => {
  const fields = [{ x: null }, { x: undefined }, { x: '' }, { y: 1201 }, { x: 0, y: 0 }];
  const h = harness(url => profileURL(url) ? player(uidOf(url), fields[+uidOf(url) - 1]) : roster([1, 2, 3, 4, 5]));
  const result = await h.service(query());
  assert.equal(result.unlocated, 4);
  assert.equal(result.failed, 0);
  assert.deepEqual(result.cities.map(c => [c.uid, c.x, c.y]), [['5', 0, 0]]);
  assert.equal(result.next_offset, null);
});

test('UID mismatches, missing roster UID, provider failure and other kingdom are accounted independently', async () => {
  const h = harness(url => {
    if (!profileURL(url)) return roster([1, 2, 3, null, 5, 6]);
    if (uidOf(url) === '1') return player('wrong');
    if (uidOf(url) === '2') return player('2', { uid: '9' });
    if (uidOf(url) === '3') return new Response('provider private detail', { status: 500 });
    return player(uidOf(url), { kid: 1777 });
  });
  const result = await h.service(query());
  assert.equal(result.processed, 5);
  assert.equal(result.failed, 4);
  assert.equal(result.outside_kingdom, 1);
  assert.equal(result.unlocated, 0);
  assert.equal(result.cities.length, 0);
  assert.equal(result.next_offset, 5);
  assert.equal(h.calls.length, 5); // No UID means no lookup, governor_id never substituted.
});

test('partial transient errors preserve successes and retry failures without consuming cached profiles', async () => {
  let fail = true;
  const h = harness(url => {
    if (!profileURL(url)) return roster([1, 2, 3]);
    if (uidOf(url) === '2' && fail) throw new Error('test-key-only private detail');
    return player(uidOf(url));
  });
  const first = await h.service(query());
  assert.equal(first.failed, 1);
  assert.deepEqual(first.cities.map(c => c.uid), ['1', '3']);
  assert.equal(first.processed, 3);
  assert.equal(first.next_offset, null);
  fail = false;
  const retry = await h.service(query());
  assert.equal(retry.failed, 0);
  assert.equal(retry.cities.length, 3);
  assert.equal(h.calls.length, 5);
});

test('auth failure is 503, never five failed members, never negatively cached', async () => {
  let authorized = false;
  const h = harness(url => !profileURL(url) ? roster([1, 2]) : authorized ? player(uidOf(url)) :
    { ok: false, status: 401, headers: new Headers(), json: () => assert.fail('must not read auth error body') });
  await assert.rejects(h.service(query()), rejection(503, 'upstream_auth'));
  assert.equal(h.calls.length, 2);
  authorized = true;
  assert.equal((await h.service(query())).cities.length, 2);
  assert.equal(h.calls.length, 4);
  const missing = createOfficialMapService({ key: () => undefined, fetch: () => assert.fail('no-key fetch') });
  await assert.rejects(missing(query()), rejection(503, 'missing_key'));
});

test('upstream 429 stops immediately, respects Retry-After, and retries from cached progress', async () => {
  let limited = true;
  const h = harness(url => {
    if (!profileURL(url)) return roster([1, 2, 3]);
    if (uidOf(url) === '2' && limited) return new Response('private quota detail', { status: 429, headers: { 'Retry-After': '120' } });
    return player(uidOf(url));
  });
  await assert.rejects(h.service(query()), e => e.status === 429 && e.retryAfter === 120);
  assert.equal(h.calls.length, 3);
  await assert.rejects(h.service(query()), rejection(429, 'rate_limited'));
  assert.equal(h.calls.length, 3);
  h.advance(120_000);
  limited = false;
  assert.equal((await h.service(query())).cities.length, 3);
  assert.equal(h.calls.length, 5);
});

test('successful responses with remaining quota zero block new starts, but permit cached data', async () => {
  const h = harness(url => Response.json(list(+new URL(url).pathname.split('/')[3]), {
    headers: { 'X-RateLimit-Remaining': '0', 'X-RateLimit-Reset': '1800000090' },
  }));
  await h.service({ kid: 1622, offset: 0 });
  await h.service({ kid: 1622, offset: 0 });
  await assert.rejects(h.service({ kid: 1623, offset: 0 }), e => e.status === 429 && e.retryAfter === 90);
  assert.equal(h.calls.length, 1);
  h.advance(90_000);
  await h.service({ kid: 1623, offset: 0 });
  assert.equal(h.calls.length, 2);
});

test('40 upstream starts/minute include roster; partial quota retry reuses completed profiles', async () => {
  const h = harness(url => profileURL(url) ? player(uidOf(url)) : roster(Array.from({ length: 45 }, (_, i) => i + 1)));
  for (let offset = 0; offset < 35; offset += 5) await h.service(query(offset));
  assert.equal(h.calls.length, 36);
  await assert.rejects(h.service(query(35)), e => e.status === 429 && e.retryAfter === 60);
  assert.equal(h.calls.length, 40);
  assert.equal((await h.service(query())).cities.length, 5);
  assert.equal(h.calls.length, 40);
  h.advance(60_000);
  assert.equal((await h.service(query(35))).cities.length, 5);
  assert.equal(h.calls.length, 41);
});

test('three distinct active requests allowed; identical requests deduplicated; no gate waits', async () => {
  const finish = [];
  const h = harness(() => new Promise(resolve => finish.push(resolve)));
  const a = h.service({ kid: 1, offset: 0 });
  const a2 = h.service({ kid: 1, offset: 0 });
  const b = h.service({ kid: 2, offset: 0 });
  const c = h.service({ kid: 3, offset: 0 });
  await assert.rejects(h.service({ kid: 4, offset: 0 }), e => e.status === 429 && e.retryAfter === 2);
  assert.equal(h.calls.length, 3);
  finish.forEach((resolve, index) => resolve(list(index + 1)));
  const results = await Promise.all([a, a2, b, c]);
  assert.deepEqual(results[0], results[1]);
});

test('overlapping batches share in-flight roster and profiles by UID across alliance tags', async () => {
  const h = harness(async url => {
    await flush();
    return profileURL(url) ? player(uidOf(url)) : roster([1, 2, 3, 4, 5, 6], uidOf(url));
  });
  await Promise.all([h.service(query()), h.service(query(1))]);
  assert.equal(h.calls.filter(profileURL).length, 6);
  assert.equal(h.calls.filter(url => !profileURL(url)).length, 1);
  await h.service(query(0, 'ABC'));
  assert.equal(h.calls.filter(profileURL).length, 6);
  assert.equal(h.calls.length, 8);
});

test('one-hour TTL, provider age shortens profile TTL, stale data has a 30-second floor', async () => {
  let age;
  const h = harness(url => profileURL(url) ? player(uidOf(url), {}, { age_seconds: age }) : roster([1]));
  const first = await h.service(query());
  h.advance(3_599_999);
  await h.service(query());
  assert.equal(h.calls.length, 2);
  h.advance(1);
  age = 2273;
  await h.service(query());
  assert.equal(h.calls.length, 4);
  h.advance(1_326_999);
  await h.service(query());
  assert.equal(h.calls.length, 4);
  h.advance(1);
  age = 9999;
  const stale = await h.service(query());
  assert.equal(h.calls.length, 5);
  assert.equal(stale.cities[0].profile_cached_at, first.cities[0].profile_cached_at);
  h.advance(29_999);
  await h.service(query());
  assert.equal(h.calls.length, 5);
  h.advance(1);
  await h.service(query());
  assert.equal(h.calls.length, 6);
});

test('bounded rank cache evicts oldest entries without interfering with recent entries', async () => {
  const h = harness(url => list(+new URL(url).pathname.split('/')[3]));
  for (let kid = 1; kid <= 101; kid++) {
    await h.service({ kid, offset: 0 });
    h.advance(2000);
  }
  await h.service({ kid: 101, offset: 0 });
  assert.equal(h.calls.length, 101);
  await h.service({ kid: 1, offset: 0 });
  assert.equal(h.calls.length, 102);
});

test('15-second profile body timeout is counted and remaining batch proceeds', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let hungSignal;
  const h = harness((url, options) => {
    if (!profileURL(url)) return roster([1, 2]);
    if (uidOf(url) === '2') return player('2');
    hungSignal = options.signal;
    return { ok: true, status: 200, headers: new Headers(), json: () => new Promise(() => {}) };
  });
  const pending = h.service(query());
  await flush();
  t.mock.timers.tick(14_999);
  assert.equal(hungSignal.aborted, false);
  t.mock.timers.tick(1);
  const result = await pending;
  assert.equal(hungSignal.aborted, true);
  assert.equal(result.failed, 1);
  assert.equal(result.processed, 2);
  assert.deepEqual(result.cities.map(c => c.uid), ['2']);
});

test('whole request deadline is 95 seconds and releases active gates', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const signals = [];
  const h = harness((_, options) => { signals.push(options.signal); return new Promise(() => {}); });
  const pending = h.service(query());
  // Advance in one tick to exercise the total deadline even if underlying work ignores abort.
  t.mock.timers.tick(95_000);
  await assert.rejects(pending, e => e.status === 504);
  assert.equal(signals[0].aborted, true);
  const retry = h.service(query());
  t.mock.timers.tick(95_000);
  await assert.rejects(retry, e => e.status === 504);
});

async function handler() {
  const guardURL = moduleURL(await compile('../src/lib/server/same-site.ts'));
  const source = (await compile('../api/alliance-map.ts'))
    .replace('../src/lib/server/same-site.js', guardURL)
    .replace('../src/lib/server/official-map.js', serviceURL)
    .replace('../src/lib/server/save-alliance-map.js', moduleURL('export async function saveAlliancePositions() { return false; }'))
    .replace('createOfficialMapService();', "createOfficialMapService({ key: () => 'test-key-only' });");
  return (await import(moduleURL(source))).default;
}
async function call(handle, url = '/api/alliance-map/?kid=1622', method = 'GET', headers = { 'sec-fetch-site': 'same-origin' }) {
  const result = { status: 200, headers: {} };
  await handle({ url, method, headers }, {
    set statusCode(value) { result.status = value; },
    setHeader(name, value) { result.headers[name] = value; },
    end(body) { result.body = JSON.parse(body); },
  });
  return result;
}

test('handler guards before upstream; validates method/query; sanitizes auth and quota responses', async t => {
  const handle = await handler();
  let status = 401;
  const fetch = t.mock.method(globalThis, 'fetch', async () => ({
    ok: false, status, headers: new Headers({ 'Retry-After': '90' }),
    json: () => assert.fail('must not read private error body'),
  }));
  for (const headers of [{}, { 'sec-fetch-site': 'cross-site' }]) {
    assert.equal((await call(handle, undefined, 'GET', headers)).status, 403);
  }
  assert.equal((await call(handle, undefined, 'POST')).status, 405);
  assert.equal((await call(handle, '/api/alliance-map/?kid=0')).status, 400);
  assert.equal(fetch.mock.callCount(), 0);
  const auth = await call(handle);
  assert.equal(auth.status, 503);
  assert.equal(auth.body.error, 'upstream_auth');
  assert.equal(auth.headers['Cache-Control'], 'no-store');
  assert.doesNotMatch(JSON.stringify(auth), /test-key-only|private/);
  status = 429;
  const limited = await call(handle);
  assert.equal(limited.status, 429);
  assert.equal(limited.headers['Retry-After'], '90');
  assert.equal(limited.body.retryAfter, 90);
  assert.equal(limited.body.error, 'rate_limited');
  assert.equal(fetch.mock.callCount(), 2);
});

test('dev route dispatches both slash forms; deployment duration accommodates the request deadline', async () => {
  // Exercise middleware dispatch without starting Vite, loading env files or touching dev caches.
  const config = await readFile(new URL('../astro.config.mjs', import.meta.url), 'utf8');
  const start = config.indexOf('function playerApi()');
  const end = config.indexOf('\n/**', start);
  const pluginFactory = new Function('loadEnv', `${config.slice(start, end)}; return playerApi;`)(() => ({}));
  let middleware;
  const paths = [];
  pluginFactory().configureServer({
    config: { mode: 'test', root: '.' },
    middlewares: { use(fn) { middleware = fn; } },
    async ssrLoadModule(path) { paths.push(path); return { default: () => {} }; },
  });
  for (const url of ['/api/alliance-map?kid=1622', '/api/alliance-map/?kid=1622']) {
    await middleware({ url }, {}, () => assert.fail('route not handled'));
  }
  assert.deepEqual(paths, ['/api/alliance-map.ts', '/api/alliance-map.ts']);
  const vercel = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.equal(vercel.functions['api/alliance-map.ts'].maxDuration, 120);
});
