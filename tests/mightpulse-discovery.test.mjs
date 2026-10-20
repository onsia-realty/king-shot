import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { get } from 'node:http';
import ts from 'typescript';

const compile = source => ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const shared = compile(await readFile(new URL('../src/lib/server/mightpulse-discovery.ts', import.meta.url), 'utf8'));
const guard = compile(await readFile(new URL('../src/lib/server/same-site.ts', import.meta.url), 'utf8'));
const rawSources = Object.fromEntries(await Promise.all(['search', 'map'].map(async name => [name,
  await readFile(new URL(`../api/${name}.ts`, import.meta.url), 'utf8')])));
const sources = Object.fromEntries(Object.entries(rawSources).map(([name, source]) => [name, compile(source)]));

test('search and map use explicit .js shared imports for Node ESM deployment', () => {
  for (const [name, source] of Object.entries(rawSources)) {
    const file = ts.createSourceFile(`${name}.ts`, source, ts.ScriptTarget.Latest, true);
    const imports = file.statements.filter(ts.isImportDeclaration)
      .map(statement => statement.moduleSpecifier.text)
      .filter(specifier => specifier.includes('mightpulse-discovery'));
    assert.deepEqual(imports, ['../src/lib/server/mightpulse-discovery.js'], `${name} must use the Node ESM .js specifier`);
  }
});
let serial = 0;
async function handler(name) {
  // 핸들러마다 새 같은 사이트 검사 모듈을 물려 요청 수 제한 카운터가 테스트끼리 섞이지 않게 한다.
  const guardURL = `data:text/javascript;base64,${Buffer.from(guard).toString('base64')}#${serial++}`;
  const sharedURL = `data:text/javascript;base64,${Buffer.from(shared.replace('./same-site.js', guardURL)).toString('base64')}#${serial++}`;
  const source = sources[name].replace(/(['"])\.\.\/src\/lib\/server\/mightpulse-discovery\.js\1/, (_, quote) => `${quote}${sharedURL}${quote}`);
  return (await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}#${serial++}`)).default;
}
async function request(handler, url, method = 'GET') {
  const headers = {};
  let body;
  const res = { statusCode: 200, setHeader(name, value) { headers[name] = value; },
    end(value) { body = JSON.parse(value); } };
  await handler({ url, method, headers: { 'sec-fetch-site': 'same-origin' } }, res);
  return { status: res.statusCode, headers, body };
}
function error(result, status, code) {
  assert.equal(result.status, status);
  assert.deepEqual(Object.keys(result.body).sort(), ['error', 'message', 'ok']);
  assert.equal(result.body.ok, false);
  assert.equal(result.body.error, code);
  assert.match(result.body.message, /[가-힣]/);
  assert.equal(result.headers['Cache-Control'], 'no-store');
  assert.doesNotMatch(JSON.stringify(result.body), /secret|<html|mock-key/);
}
const row = { uid: 60611017, fid: 241496933, nick_name: 'Zeras', kid: 1622,
  power: 100, town_center_level: 30, x: 0, y: 641, alliance_abbr: 'ABC',
  alliance_name: 'Alliance', avatar_url: '/assets/avatar.png', online: true, last_login: 'secret' };
const searchData = { query: 'ignored', results: [row, { ...row, kid: 1 }], live: false };
const city = { ...row, tc: 30, stove_lv: 30, map_kid: 1622, aid: 123,
  shield_active: false, burn_active: true, city_skin_icon: '/assets/skin.png' };
const alliance = { aid: 123, abbr: 'ABC', name: 'Alliance', city_count: 2,
  cx: 0, cy: 641, power_sum: 200, flag_url: '/assets/flag.png', flag: [6] };
const mapData = { kid: 1622, bounds: { min: 0, max: 1200 }, cities: [city], alliances: [alliance],
  stats: { location_updated_at: 1791891670.9836166 }, objects: [{ secret: true }], mighty: { secret: true } };

test('methods, bounded queries and kingdoms reject before fetch', async t => {
  const search = await handler('search'), map = await handler('map');
  const fetch = t.mock.method(globalThis, 'fetch', () => assert.fail('unexpected fetch'));
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
  assert.equal(fetch.mock.callCount(), 0);
});

test('global search fixed host, encoded query, live=0, credential isolation and allowlist', async t => {
  const search = await handler('search');
  t.mock.timers.enable({ apis: ['Date'], now: 1_000_000 });
  const previous = process.env.MIGHTPULSE_API_KEY;
  process.env.MIGHTPULSE_API_KEY = 'mock-key-secret';
  t.after(() => { if (previous === undefined) delete process.env.MIGHTPULSE_API_KEY;
    else process.env.MIGHTPULSE_API_KEY = previous; });
  const query = 'Ze &live=1 https://evil.test';
  const fetch = t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, `https://mightpulse.com/api/search?q=${encodeURIComponent(query)}&live=0`);
    assert.equal(options.headers, undefined);
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    return Response.json(searchData);
  });
  const result = await request(search, `/api/search?q=${encodeURIComponent(` ${query} `)}&live=1&host=evil.test`);
  assert.equal(result.status, 200);
  assert.equal(result.body.query, query);
  assert.equal(result.body.total, 2);
  assert.deepEqual(result.body.results[0], Object.fromEntries(Object.entries(row).filter(([k]) => !['online', 'last_login'].includes(k))));
  assert.equal(result.headers['Cache-Control'], 'public, max-age=0, s-maxage=300');
  assert.equal((await request(search, `/api/search?q=${encodeURIComponent(query)}`)).body.total, 2);
  assert.equal(fetch.mock.callCount(), 1);
});

test('kingdom search scans the full snapshot, separates caches and preserves UID without inventing FID', async t => {
  const search = await handler('search');
  const hassan = { uid: 60598835, nick_name: 'hassan', kid: 1622, map_kid: 1622,
    alliance_abbr: 'BOO', x: 690, y: 913, tc: 38, power: 98151218 };
  const fetch = t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(options.headers, undefined);
    if (url.includes('/search?')) return Response.json({ results: Array(40).fill({ ...row, kid: 1 }) });
    const kid = Number(new URL(url).searchParams.get('kid'));
    assert.equal(url, `https://mightpulse.com/api/map?kid=${kid}&layers=cities&limit=50000`);
    return Response.json({ ...mapData, kid, cities: [
      ...Array(150).fill({ ...city, kid }), { ...hassan, kid },
    ] });
  });
  assert.equal((await request(search, '/api/search?q=hassan')).body.total, 40);
  const found = await request(search, '/api/search?q=HaSsAn&kid=1622');
  assert.equal(found.status, 200);
  assert.equal(found.body.query, 'HaSsAn');
  assert.equal(found.body.total, 1);
  assert.equal(found.body.results[0].uid, 60598835);
  assert.equal(found.body.results[0].fid, null);
  assert.equal(found.body.results[0].town_center_level, 38);
  const otherQuery = await request(search, '/api/search?q=ZeRa&kid=01622');
  assert.equal(otherQuery.body.query, 'ZeRa');
  assert.equal(otherQuery.body.total, 100);
  assert.equal(otherQuery.body.results.length, 100);
  assert.ok(otherQuery.body.results.every(item => item.nick_name === 'Zeras'));
  const missing = await request(search, '/api/search?q=missing&kid=1622');
  assert.equal(missing.body.total, 0);
  assert.equal(missing.body.query, 'missing');
  assert.equal(fetch.mock.callCount(), 2);
  assert.equal((await request(search, '/api/search?q=hassan&kid=1623')).body.results[0].kid, 1623);
  await request(search, '/api/search?q=Zeras');
  assert.equal(fetch.mock.callCount(), 4);
});

test('concurrent queries share a kingdom fetch but receive their own filtered results', async t => {
  const search = await handler('search');
  let finish;
  const fetch = t.mock.method(globalThis, 'fetch', () => new Promise(resolve => { finish = resolve; }));
  const first = request(search, '/api/search?q=Zer&kid=1622');
  const second = request(search, '/api/search?q=absent&kid=1622');
  assert.equal(fetch.mock.callCount(), 1);
  finish(Response.json(mapData));
  assert.equal((await first).body.total, 1);
  const missing = await second;
  assert.equal(missing.body.query, 'absent');
  assert.equal(missing.body.total, 0);
});

test('kingdom map failures are errors, never cached empty successes', async t => {
  const search = await handler('search');
  const url = '/api/search?q=hassan&kid=1622';
  for (const data of [null, [], {}, searchData, { cities: {} }, { ok: false, cities: [] },
    { cities: [null] }, { cities: [{}] }, { cities: [{ uid: 1, nick_name: {} }] },
    { ...mapData, kid: 1 }]) {
    const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json(data));
    error(await request(search, url), 502, 'upstream_error');
    error(await request(search, url), 502, 'upstream_error');
    assert.equal(fetch.mock.callCount(), 2);
    fetch.mock.restore();
  }
  for (const status of [429, 500, 502]) {
    const fetch = t.mock.method(globalThis, 'fetch', async () => new Response('', { status }));
    error(await request(search, url), status === 429 ? 429 : 502, status === 429 ? 'rate_limited' : 'upstream_error');
    fetch.mock.restore();
  }
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response('<html>secret</html>'));
  error(await request(search, url), 502, 'upstream_error');
  fetch.mock.restore();
  t.mock.method(globalThis, 'fetch', async () => Response.json({ ...mapData, cities: [] }));
  const empty = await request(search, url);
  assert.equal(empty.status, 200);
  assert.equal(empty.body.total, 0);
});

test('map fixed URL, public credential isolation, finite coordinates including zero and allowlist', async t => {
  const map = await handler('map');
  const fetch = t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://mightpulse.com/api/map?kid=1622&layers=cities&limit=50000');
    assert.equal(options.headers, undefined);
    assert.equal(options.redirect, 'error');
    return { ok: true, json: async () => ({ ...mapData, cities: [city, null,
      { ...city, x: NaN }, { ...city, y: Infinity }, { ...city, x: -1 }, { ...city, y: 1201 },
      { ...city, x: null }, { ...city, uid: null }] }) };
  });
  const result = await request(map, '/api/map?kid=01622&layers=camp&limit=1&host=evil.test');
  assert.equal(result.status, 200);
  assert.equal(result.body.cities.length, 1);
  assert.equal(result.body.cities[0].x, 0);
  assert.equal(result.body.cities[0].uid, 60611017);
  assert.equal(result.body.cities[0].fid, undefined);
  assert.deepEqual(Object.keys(result.body).sort(), ['alliances', 'bounds', 'cities', 'kid', 'ok', 'updated_at']);
  assert.deepEqual(result.body.alliances, [Object.fromEntries(Object.entries(alliance).filter(([k]) => k !== 'flag'))]);
  assert.equal(result.body.updated_at, mapData.stats.location_updated_at);
  assert.doesNotMatch(JSON.stringify(result.body), /online|last_login|secret|town_center_level/);
  assert.equal(fetch.mock.callCount(), 1);
});

test('valid input boundaries and malformed row fields normalize to primitives or null', async t => {
  const search = await handler('search'), map = await handler('map');
  t.mock.method(globalThis, 'fetch', async url => Response.json(url.includes('/search?')
    ? { results: [null, {}, { ...row, nick_name: { secret: true }, power: {}, avatar_url: [],
      x: null, alliance_name: { secret: true } }] }
    : { ...mapData, stats: {}, cities: [{ ...city, power: {}, shield_active: {}, city_skin_icon: {} }],
      alliances: [null, {}, { ...alliance, name: {}, flag_url: {} }] }));
  for (const query of ['ab', 'a'.repeat(80)]) {
    const result = await request(search, `/api/search?q=${query}`);
    assert.equal(result.status, 200);
    assert.equal(result.body.total, 1);
    for (const key of ['nick_name', 'power', 'avatar_url', 'x', 'alliance_name']) {
      assert.equal(result.body.results[0][key], null);
    }
  }
  for (const kid of [1, 10000]) {
    const result = await request(map, `/api/map?kid=${kid}`);
    assert.equal(result.status, 200);
    assert.equal(result.body.kid, kid);
    assert.equal(result.body.updated_at, null);
    assert.equal(result.body.cities[0].power, null);
    assert.equal(result.body.cities[0].shield_active, null);
    assert.equal(result.body.cities[0].city_skin_icon, null);
    assert.equal(result.body.alliances.length, 1);
    assert.equal(result.body.alliances[0].name, null);
    assert.equal(result.body.alliances[0].flag_url, null);
  }
});

test('malformed upstream shapes, HTML and HTTP errors stay safe and uncached', async t => {
  for (const name of ['search', 'map']) {
    const h = await handler(name), url = name === 'search' ? '/api/search?q=Zeras' : '/api/map?kid=1622';
    const invalid = name === 'search' ? [null, [], {}, { results: {} }, { ok: false, results: [] }]
      : [null, {}, { ...mapData, bounds: { min: 0, max: Infinity } }, { ...mapData, bounds: { min: 2, max: 1 } },
        { ...mapData, cities: {} }, { ...mapData, alliances: null }];
    for (const data of invalid) {
      const fetch = t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => data }));
      error(await request(h, url), 502, 'upstream_error');
      error(await request(h, url), 502, 'upstream_error');
      assert.equal(fetch.mock.callCount(), 2);
      fetch.mock.restore();
    }
    for (const status of [302, 401, 403, 404, 429, 500]) {
      const fetch = t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status,
        json() { assert.fail('error body read'); } }));
      error(await request(h, url), status === 429 ? 429 : 502, status === 429 ? 'rate_limited' : 'upstream_error');
      fetch.mock.restore();
    }
    const fetch = t.mock.method(globalThis, 'fetch', async () => new Response('<html>secret</html>'));
    error(await request(h, url), 502, 'upstream_error');
    fetch.mock.restore();
  }
});

for (const [name, ttl, limit] of [['search', 300_000, 100], ['map', 600_000, 10]]) {
  const url = id => name === 'search' ? `/api/search?q=player${id}` : `/api/map?kid=${id}`;
  const fixture = name === 'search' ? searchData : mapData;
  test(`${name} TTL, oldest eviction, in-flight dedup and bounded concurrency`, async t => {
    const h = await handler(name);
    t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 1_000_000 });
    let finish;
    const fetch = t.mock.method(globalThis, 'fetch', () => new Promise(resolve => { finish = resolve; }));
    const first = request(h, url(1)), second = request(h, url(1));
    assert.equal(fetch.mock.callCount(), 1);
    finish(Response.json(fixture));
    assert.deepEqual((await first).body, (await second).body);
    t.mock.timers.tick(ttl - 1000);
    assert.equal((await request(h, url(1))).headers['Cache-Control'], 'public, max-age=0, s-maxage=1');
    t.mock.timers.tick(1000);
    const fresh = request(h, url(1));
    assert.equal(fetch.mock.callCount(), 2);
    finish(Response.json(fixture));
    await fresh;
    fetch.mock.restore();
    const fast = t.mock.method(globalThis, 'fetch', async () => Response.json(fixture));
    for (let n = 2; n <= limit + 1; n++) await request(h, url(n));
    await request(h, url(limit + 1));
    assert.equal(fast.mock.callCount(), limit);
    await request(h, url(1));
    assert.equal(fast.mock.callCount(), limit + 1);
    fast.mock.restore();
    const blocked = t.mock.method(globalThis, 'fetch', () => new Promise(() => {}));
    const requests = Array.from({ length: limit }, (_, i) => request(h, url(i + 500)));
    error(await request(h, url(9999)), 429, 'rate_limited');
    assert.equal(blocked.mock.callCount(), limit);
    t.mock.timers.tick(30_000);
    for (const result of await Promise.all(requests)) error(result, 504, 'timeout');
  });
  test(`${name} timeout covers response body, aborts and permits retry`, async t => {
    const h = await handler(name);
    t.mock.timers.enable({ apis: ['setTimeout'] });
    let signal;
    const fetch = t.mock.method(globalThis, 'fetch', async (_, options) => {
      signal = options.signal;
      return { ok: true, json: () => new Promise(() => {}) };
    });
    const first = request(h, url(1));
    t.mock.timers.tick(29_999);
    assert.equal(signal.aborted, false);
    t.mock.timers.tick(1);
    error(await first, 504, 'timeout');
    assert.equal(signal.aborted, true);
    const retry = request(h, url(1));
    assert.equal(fetch.mock.callCount(), 2);
    t.mock.timers.tick(30_000);
    error(await retry, 504, 'timeout');
  });
}

test('search caps at 100 and map at 50000; objects never cross the allowlist', async t => {
  const search = await handler('search'), map = await handler('map');
  t.mock.method(globalThis, 'fetch', async url => Response.json(url.includes('/search?')
    ? { results: [...Array(101).fill(row), { uid: { secret: true } }] }
    : { ...mapData, cities: Array(50001).fill(city) }));
  assert.equal((await request(search, '/api/search?q=Zeras')).body.total, 100);
  assert.equal((await request(map, '/api/map?kid=1622')).body.cities.length, 50000);
});

test('dev middleware serves search/map on both slash variants', async t => {
  const { createServer } = await import('vite');
  const { default: config } = await import('../astro.config.mjs');
  const plugin = config.vite.plugins.find(item => item.name === 'mightpulse-player-api');
  const server = await createServer({ configFile: false, plugins: [plugin], server: { port: 0, host: '127.0.0.1' }, appType: 'custom' });
  t.after(() => server.close());
  await server.listen();
  const address = server.httpServer.address();
  const fetch = t.mock.method(globalThis, 'fetch', async url => Response.json(url.includes('/search?') ? searchData : mapData));
  for (const url of ['/api/search?q=Zeras', '/api/search/?q=Zeras', '/api/map?kid=1622', '/api/map/?kid=1622']) {
    const result = await new Promise((resolve, reject) => {
      get(`http://127.0.0.1:${address.port}${url}`, { headers: { 'sec-fetch-site': 'same-origin' } }, res => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
      }).on('error', reject);
    });
    assert.equal(result.status, 200);
    assert.equal(result.body.ok, true);
  }
  assert.equal(fetch.mock.callCount(), 2);
});
