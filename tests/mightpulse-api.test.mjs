import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { get } from 'node:http';
import ts from 'typescript';

const source = await readFile(new URL('../api/player.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const guard = ts.transpileModule(await readFile(new URL('../src/lib/server/same-site.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
let serial = 0;
const fixture = {
  ok: true, uid: 60611017, governor_id: 241496933,
  player: { nick_name: 'Test player', heroes: ['wrong nested section'] },
  heroes: [{ id: 1, gear: [{ enhancement_level: 10 }] }],
  ranks: { power_rank: 12 },
  gov_gear: { hidden: true, items: [], message: '영주 장비가 비공개로 설정되어 있습니다.' },
  fresh: false, cached_at: '2026-10-14T00:00:00Z', age_seconds: 60,
  provider_private: 'must not be forwarded',
};
async function setup(t) {
  const previous = process.env.MIGHTPULSE_API_KEY;
  process.env.MIGHTPULSE_API_KEY = 'mock-key-only';
  t.after(() => {
    if (previous === undefined) delete process.env.MIGHTPULSE_API_KEY;
    else process.env.MIGHTPULSE_API_KEY = previous;
  });
  // 핸들러마다 새 같은 사이트 검사 모듈을 물려 요청 수 제한 카운터가 테스트끼리 섞이지 않게 한다.
  const guardURL = `data:text/javascript;base64,${Buffer.from(guard).toString('base64')}#${serial++}`;
  const source = compiled.replace('../src/lib/server/same-site.js', guardURL);
  return (await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}#${serial++}`)).default;
}
async function request(handler, url = '/api/player/?id=241496933', method = 'GET') {
  const headers = {};
  let body;
  const res = {
    statusCode: 200,
    setHeader(name, value) { headers[name] = value; },
    end(value) { body = JSON.parse(value); this.finished = true; },
  };
  await handler({ url, method, headers: { 'sec-fetch-site': 'same-origin' } }, res);
  return { status: res.statusCode, headers, body };
}
function error(result, status, code) {
  assert.equal(result.status, status);
  assert.equal(result.body.ok, false);
  assert.equal(result.body.error, code);
  assert.match(result.body.message, /[가-힣]/);
  assert.deepEqual(Object.keys(result.body).sort(), ['error', 'message', 'ok']);
  assert.equal(result.headers['Cache-Control'], 'no-store');
}

test('method and IDs are rejected before key validation or fetch', async t => {
  const handler = await setup(t);
  delete process.env.MIGHTPULSE_API_KEY;
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('unexpected fetch'); });
  for (const method of ['POST', 'PUT', 'HEAD', 'OPTIONS']) {
    const result = await request(handler, '/api/player/', method);
    error(result, 405, 'invalid_method');
    assert.equal(result.headers.Allow, 'GET');
  }
  for (const query of ['', '?id=', '?id=0', '?id=000', '?id=-1', '?id=1.1',
    '?id=1e3', '?id=%201', '?id=1234567890123456', '?id=https://evil.test',
    '?id=1&id=2', '?id=1%0A', '?id=../1']) {
    error(await request(handler, `/api/player/${query}`), 400, 'invalid_id');
  }
  error(await request(handler), 503, 'missing_key');
  assert.equal(fetch.mock.callCount(), 0);
});

test('fixed URL, bearer header, top-level allowlist and hidden gear', async t => {
  const handler = await setup(t);
  t.mock.timers.enable({ apis: ['Date'], now: 1_000_000 });
  const fetch = t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://api.mightpulse.com/v1/players/241496933?include=base,heroes,ranks,gov_gear');
    assert.deepEqual(options.headers, { Authorization: 'Bearer mock-key-only' });
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    return Response.json(fixture);
  });
  const result = await request(handler, '/api/player?id=000241496933&host=evil.test');
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, Object.fromEntries(Object.entries(fixture).filter(([key]) => key !== 'provider_private')));
  assert.equal(result.headers['Cache-Control'], 'public, max-age=0, s-maxage=300');
  assert.equal(fetch.mock.callCount(), 1);
});

test('hidden governor gear discards accidental items and localizes the notice', async t => {
  const handler = await setup(t);
  t.mock.method(globalThis, 'fetch', async () => Response.json({
    ...fixture, gov_gear: { hidden: true, items: [{ equipid: 123 }], message: 'Private provider detail' },
  }));
  const result = await request(handler);
  assert.deepEqual(result.body.gov_gear, fixture.gov_gear);
  assert.doesNotMatch(JSON.stringify(result.body), /Private provider detail|equipid/);
});

test('positive ID boundaries accepted and visible gear retained', async t => {
  const handler = await setup(t);
  const gear = { hidden: false, items: [{ equipid: 123 }], message: null };
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json({ ...fixture, gov_gear: gear }));
  for (const id of ['1', '999999999999999']) {
    const result = await request(handler, `/api/player?id=${id}`);
    assert.equal(result.status, 200);
    assert.deepEqual(result.body.gov_gear, gear);
  }
  assert.equal(fetch.mock.callCount(), 2);
});

test('UID selection validates type and keeps cache/in-flight keys separate from FID', async t => {
  const handler = await setup(t);
  const urls = [];
  const finish = [];
  const fetch = t.mock.method(globalThis, 'fetch', (url) => {
    urls.push(url);
    return new Promise(resolve => finish.push(resolve));
  });
  for (const suffix of ['&id_type=', '&id_type=fid', '&id_type=UID', '&id_type=uid&id_type=uid']) {
    error(await request(handler, `/api/player?id=1${suffix}`), 400, 'invalid_id_type');
  }
  assert.equal(fetch.mock.callCount(), 0);
  const fid = request(handler, '/api/player?id=60611017');
  const uid = request(handler, '/api/player?id=60611017&id_type=uid');
  const uidAgain = request(handler, '/api/player?id=00060611017&id_type=uid');
  assert.equal(fetch.mock.callCount(), 2);
  assert.equal(urls[0], 'https://api.mightpulse.com/v1/players/60611017?include=base,heroes,ranks,gov_gear');
  assert.equal(urls[1], `${urls[0]}&id_type=uid`);
  finish[0](Response.json({ ...fixture, governor_id: 60611017 }));
  finish[1](Response.json(fixture));
  assert.equal((await fid).body.governor_id, 60611017);
  assert.equal((await uid).body.governor_id, 241496933);
  assert.equal((await uidAgain).body.governor_id, 241496933);
  assert.equal((await request(handler, '/api/player?id=60611017&id_type=governor_id')).body.governor_id, 60611017);
  assert.equal((await request(handler, '/api/player?id=60611017&id_type=uid')).body.governor_id, 241496933);
  assert.equal(fetch.mock.callCount(), 2);
});

test('provider HTTP errors never read or expose error bodies and are not cached', async t => {
  const handler = await setup(t);
  const log = t.mock.method(console, 'log', () => {});
  const warn = t.mock.method(console, 'warn', () => {});
  const stderr = t.mock.method(console, 'error', () => {});
  for (const [status, expected, code] of [[401, 502, 'upstream_auth'], [403, 502, 'upstream_auth'],
    [404, 404, 'not_found'], [429, 429, 'rate_limited'], [500, 502, 'upstream_error'],
    [302, 502, 'upstream_error'], [400, 502, 'upstream_error']]) {
    const fetch = t.mock.method(globalThis, 'fetch', async () => ({
      ok: false, status,
      json() { assert.fail('provider error body read'); },
      text() { assert.fail('provider error body read'); },
    }));
    for (let n = 0; n < 2; n++) error(await request(handler), expected, code);
    assert.equal(fetch.mock.callCount(), 2);
    fetch.mock.restore();
  }
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('mock-key-only provider private detail'); });
  const result = await request(handler);
  error(result, 502, 'upstream_error');
  assert.doesNotMatch(JSON.stringify(result.body), /mock-key|private detail/);
  assert.equal(log.mock.callCount() + warn.mock.callCount() + stderr.mock.callCount(), 0);
});

test('malformed successful responses become safe upstream errors', async t => {
  const handler = await setup(t);
  for (const data of [null, { ok: false, message: 'secret' }, { ...fixture, player: null },
    { ...fixture, heroes: undefined }, { ...fixture, ranks: [] }, { ...fixture, gov_gear: undefined }]) {
    const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json(data));
    error(await request(handler), 502, 'upstream_error');
    fetch.mock.restore();
  }
  t.mock.method(globalThis, 'fetch', async () => new Response('not json'));
  error(await request(handler), 502, 'upstream_error');
});

test('cache TTL, age and CDN lifetime; same-ID in-flight deduplication', async t => {
  const handler = await setup(t);
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 1_000_000 });
  let finish;
  const fetch = t.mock.method(globalThis, 'fetch', () => new Promise(resolve => { finish = resolve; }));
  const first = request(handler);
  const second = request(handler, '/api/player?id=241496933');
  assert.equal(fetch.mock.callCount(), 1);
  finish(Response.json(fixture));
  assert.deepEqual((await first).body, (await second).body);
  t.mock.timers.tick(120_000);
  const cached = await request(handler);
  assert.equal(fetch.mock.callCount(), 1);
  assert.equal(cached.body.age_seconds, 180);
  assert.equal(cached.body.cached_at, fixture.cached_at);
  assert.equal(cached.body.fresh, false);
  assert.equal(cached.headers['Cache-Control'], 'public, max-age=0, s-maxage=180');
  t.mock.timers.tick(180_000);
  const refreshed = request(handler);
  assert.equal(fetch.mock.callCount(), 2);
  finish(Response.json(fixture));
  assert.equal((await refreshed).body.age_seconds, 60);
});

test('95-second timeout aborts fetch/body and releases pending request for retry', async t => {
  const handler = await setup(t);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let signal;
  const fetch = t.mock.method(globalThis, 'fetch', async (_, options) => {
    signal = options.signal;
    return { ok: true, json: () => new Promise(() => {}) };
  });
  const result = request(handler);
  t.mock.timers.tick(90_000);
  assert.equal(signal.aborted, false);
  t.mock.timers.tick(5_000);
  error(await result, 504, 'timeout');
  assert.equal(signal.aborted, true);
  const retry = request(handler);
  assert.equal(fetch.mock.callCount(), 2);
  t.mock.timers.tick(95_000);
  error(await retry, 504, 'timeout');
});

test('cache evicts oldest entry at 100 successful IDs', async t => {
  const handler = await setup(t);
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json(fixture));
  for (let id = 1; id <= 101; id++) assert.equal((await request(handler, `/api/player?id=${id}`)).status, 200);
  await request(handler, '/api/player?id=101');
  assert.equal(fetch.mock.callCount(), 101);
  await request(handler, '/api/player?id=1');
  assert.equal(fetch.mock.callCount(), 102);
});

test('Vite dev middleware uses the Node handler for both slash variants', async t => {
  await setup(t);
  const { createServer } = await import('vite');
  const { default: config } = await import('../astro.config.mjs');
  const plugin = config.vite.plugins.find(item => item.name === 'mightpulse-player-api');
  const server = await createServer({ configFile: false, plugins: [plugin], server: { port: 0, host: '127.0.0.1' }, appType: 'custom' });
  t.after(() => server.close());
  await server.listen();
  const address = server.httpServer.address();
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json(fixture));
  for (const url of ['/api/player?id=241496933', '/api/player/?id=241496933']) {
    const result = await new Promise((resolve, reject) => {
      get(`http://127.0.0.1:${address.port}${url}`, { headers: { 'sec-fetch-site': 'same-origin' } }, res => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
      }).on('error', reject);
    });
    assert.equal(result.status, 200);
    assert.deepEqual(result.body.heroes, fixture.heroes);
  }
  assert.equal(fetch.mock.callCount(), 1);
});
