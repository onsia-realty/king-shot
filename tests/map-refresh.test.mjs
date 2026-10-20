import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

let serial = 0;
const compile = async path => ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const moduleURL = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}#${serial++}`;
const responseURL = moduleURL(await compile('../src/lib/api-response.ts'));
const client = await import(moduleURL((await compile('../src/lib/map-refresh.ts')).replace('./api-response', responseURL)));
async function api(name) {
  // 핸들러마다 새 같은 사이트 검사 모듈을 물려 요청 수 제한 카운터가 테스트끼리 섞이지 않게 한다.
  const guard = moduleURL(await compile('../src/lib/server/same-site.ts'));
  const shared = moduleURL((await compile('../src/lib/server/mightpulse-discovery.ts')).replace('./same-site.js', guard));
  return (await import(moduleURL((await compile(`../api/${name}.ts`)).replace('../src/lib/server/mightpulse-discovery.js', shared)
    .replace('../src/lib/server/same-site.js', guard)))).default;
}
async function request(handler, url, method = 'GET') {
  const headers = {};
  let body;
  const res = { statusCode: 200, setHeader(k, v) { headers[k] = v; }, end(data) { body = JSON.parse(data); } };
  await handler({ method, url, headers: { 'sec-fetch-site': 'same-origin', authorization: 'secret', cookie: 'secret', 'x-forwarded-for': 'spoof' } }, res);
  return { status: res.statusCode, headers, body };
}
const fixture = time => ({ ok: true, kid: 1622, bounds: { min: 0, max: 1200 }, cities: [{ uid: 60646302, x: time > 100 ? 840 : 740, y: time > 100 ? 123 : 549 }], alliances: [], updated_at: time });
const upstream = time => ({ ...fixture(time), stats: { location_updated_at: time }, cached_at: '2099-01-01' });
const status = (job = null, time = 100) => ({ ok: true, job, last_finished_at: time });
const tick = () => new Promise(resolve => setImmediate(resolve));

test('proxy validates kid/token/method before fetch and never forwards credentials', async t => {
  const handler = await api('map-refresh');
  const fetch = t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://mightpulse.com/api/map/update?kid=1622&token=t_stable');
    assert.equal(options.method, 'POST'); assert.equal(options.headers, undefined); assert.equal(options.redirect, 'error');
    return Response.json({ ...status({ status: 'queued', job_id: 'j1', secret: 'secret' }), request_token: 'server-token', secret: 'secret' });
  });
  for (const kid of ['0', '10001', '1&kid=2', '1e3', '']) assert.equal((await request(handler, `/api/map-refresh?kid=${kid}&token=t_stable`, 'POST')).status, 400);
  for (const token of ['', 'a&token=b', '%0Asecret']) assert.equal((await request(handler, `/api/map-refresh?kid=1622&token=${token}`, 'POST')).status, 400);
  assert.equal((await request(handler, '/api/map-refresh?kid=1622&token=t_stable', 'PUT')).status, 405);
  assert.equal(fetch.mock.callCount(), 0);
  const result = await request(handler, '/api/map-refresh?kid=1622&token=t_stable', 'POST');
  assert.equal(result.body.job.status, 'queued'); assert.equal(result.body.request_token, 'server-token');
  assert.doesNotMatch(JSON.stringify(result.body), /secret/); assert.equal(result.headers['Cache-Control'], 'no-store');
});

test('proxy status is GET, retains business cooldown and HTTP429 retry headers, sanitizes errors', async t => {
  const handler = await api('map-refresh');
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.match(url, /\/update\/status\?/); assert.equal(options.method, 'GET');
    return Response.json({ ok: false, error: 'ip_cooldown', cooldown_remaining_sec: 475, ip_cooldown_remaining_sec: 447, message: 'secret', request_token: 'uuid-123' }, { status: 429, headers: { 'Retry-After': '447' } });
  });
  const result = await request(handler, '/api/map-refresh?kid=1622&token=t_stable');
  assert.equal(result.status, 429); assert.equal(result.body.error, 'ip_cooldown');
  assert.equal(result.body.cooldown_remaining_sec, 475); assert.equal(result.headers['Retry-After'], '447');
  assert.doesNotMatch(JSON.stringify(result.body), /secret/);
});

test('fresh snapshot bypasses ten-minute cache, coalesces requests, expires after5s and uses collected time', async t => {
  const handler = await api('map');
  t.mock.timers.enable({ apis: ['Date'], now: 100000 });
  let time = 100;
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json(upstream(time)));
  const url = '/api/map?kid=1622';
  assert.equal((await request(handler, url)).body.updated_at, 100);
  time = 200;
  const result = await request(handler, `${url}&fresh=1`);
  assert.equal(result.body.updated_at, 200); assert.equal(result.headers['Cache-Control'], 'no-store');
  await request(handler, `${url}&fresh=1`); assert.equal(fetch.mock.callCount(), 2);
  assert.equal((await request(handler, url)).body.cities[0].x, 840);
  t.mock.timers.tick(5000); time = 300;
  assert.equal((await request(handler, `${url}&fresh=1`)).body.updated_at, 300);
});

test('older ordinary in-flight snapshot cannot overwrite a completed fresh fetch', async t => {
  const handler = await api('map');
  let release;
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => ++calls === 1 ? new Promise(resolve => { release = resolve; }) : Response.json(upstream(200)));
  const old = request(handler, '/api/map?kid=1622');
  await request(handler, '/api/map?kid=1622&fresh=1');
  release(Response.json(upstream(100)));
  assert.equal((await old).body.updated_at, 200);
  assert.equal((await request(handler, '/api/map?kid=1622')).body.updated_at, 200);
});

test('cooldown refreshes saved coordinates without claiming scan completion and keeps replacement token', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push([url, options.method]);
    if (url.startsWith('/api/map/?')) return Response.json(fixture(200));
    if (options.method === 'GET') return Response.json(status());
    return Response.json({ ok: false, error: 'cooldown', cooldown_remaining_sec: 475, request_token: 'replacement-token' });
  });
  const result = await client.refreshMap(1622, new AbortController().signal, () => {}, 100);
  assert.equal(result.completed, false); assert.equal(result.snapshot.cities[0].x, 840);
  assert.equal(calls.filter(([, method]) => method === 'POST').length, 1);
  assert.match(calls.at(-1)[0], /fresh=1/); assert.equal(client.scanToken(), 'replacement-token');
  assert.equal(client.selectedCity(result.snapshot.cities, '60646302').y, 123);
  assert.equal(client.selectedCity([], 60646302), null);
});

for (const disappear of [false, true]) test(`queued/running completion${disappear ? ' with job:null' : ' with done'} waits for advanced collection time`, async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let polls = 0, snapshots = 0, posts = 0;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url.startsWith('/api/map/?')) return Response.json(fixture(++snapshots === 1 ? 100 : 200));
    if (options.method === 'POST') { posts++; return Response.json(status({ status: 'queued', job_id: 'j1' })); }
    polls++;
    if (polls === 1) return Response.json(status());
    if (polls === 2) return Response.json(status({ status: 'running', job_id: 'j1' }));
    return Response.json(status(disappear ? null : { status: 'done', job_id: 'j1' }, 200));
  });
  let resolved = false;
  const work = client.refreshMap(1622, new AbortController().signal, () => {}, 100).then(result => { resolved = true; return result; });
  await tick(); assert.equal(resolved, false);
  for (let i = 0; i < 3; i++) { t.mock.timers.tick(5000); await tick(); if (i < 2) assert.equal(resolved, false); }
  assert.equal((await work).completed, true); assert.equal(snapshots, 2); assert.equal(posts, 1);
});

for (const baseline of [undefined, null]) test(`explicit done without initial timestamps loads saved map once (baseline ${baseline})`, async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let calls = 0, snapshots = 0, posts = 0;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls++;
    if (url.startsWith('/api/map/?')) {
      snapshots++;
      assert.match(url, /fresh=1/);
      return Response.json(fixture(200));
    }
    if (options.method === 'POST') {
      posts++;
      return Response.json({ ok: true, job: { status: 'queued', job_id: 'j1' } });
    }
    return Response.json(calls === 1 ? { ok: true, job: null }
      : { ok: true, job: { status: 'done', job_id: 'j1' }, last_finished_at: 200 });
  });
  let result;
  const work = client.refreshMap(1622, new AbortController().signal, () => {}, baseline).then(value => { result = value; });
  await tick();
  assert.equal(result, undefined);
  t.mock.timers.tick(5000); await tick();
  assert.ok(result, 'must return after explicit done, without further polling');
  await work;
  assert.equal(result.completed, false);
  assert.equal(result.snapshot.updated_at, 200);
  assert.equal(posts, 1); assert.equal(snapshots, 1); assert.equal(calls, 4);
  t.mock.timers.tick(300000); await tick();
  assert.equal(calls, 4);
});

test('disappearing job without advanced finish never succeeds; cancellation stops polling', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (_, options) => { calls++; return Response.json(options.method === 'POST' ? status({ status: 'running', job_id: 'j1' }) : status()); });
  const controller = new AbortController();
  const work = client.refreshMap(1622, controller.signal, () => {}, 100);
  const rejected = assert.rejects(work, { name: 'AbortError' });
  await tick(); t.mock.timers.tick(5000); await tick(); controller.abort(); await rejected;
  const count = calls; t.mock.timers.tick(300000); await tick(); assert.equal(calls, count);
});

test('replaced job cannot masquerade as successful completion', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => Response.json(++calls === 1 ? status() : calls === 2 ? status({ status: 'queued', job_id: 'j1' }) : status({ status: 'done', job_id: 'j2' }, 200)));
  const work = assert.rejects(client.refreshMap(1622, new AbortController().signal, () => {}, 100), /scan_replaced/);
  await tick(); t.mock.timers.tick(5000); await work;
});

test('queue polling stops at its bounded attempt limit', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return Response.json(status({ status: 'queued', job_id: 'j1' })); });
  const work = assert.rejects(client.refreshMap(1622, new AbortController().signal, () => {}, 100), /timeout/);
  await tick();
  for (let i = 0; i < 60; i++) { t.mock.timers.tick(5000); await tick(); }
  await work; assert.equal(calls, 62);
});

test('Retry-After reaches the client cooldown state without retrying a mutation', async t => {
  let calls = 0, reported;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return Response.json({ ok: false, error: 'rate_limited' }, { status: 429, headers: { 'Retry-After': '90' } }); });
  await assert.rejects(client.refreshMap(1622, new AbortController().signal, state => { reported = state; }, 100), /rate_limited/);
  assert.equal(calls, 1); assert.equal(reported.cooldown_remaining_sec, 90);
});

test('proxy timeout covers a stalled response body and aborts its request', async t => {
  const handler = await api('map-refresh');
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let signal;
  t.mock.method(globalThis, 'fetch', async (_, options) => { signal = options.signal; return { headers: new Headers(), ok: true, json: () => new Promise(() => {}) }; });
  const work = request(handler, '/api/map-refresh?kid=1622&token=t_stable', 'POST');
  await tick(); t.mock.timers.tick(30000);
  assert.equal((await work).status, 504); assert.equal(signal.aborted, true);
});

test('dev routing supports status and start on both slash variants', async t => {
  const { createServer } = await import('vite');
  const { request: httpRequest } = await import('node:http');
  const { default: config } = await import('../astro.config.mjs');
  const plugin = config.vite.plugins.find(item => item.name === 'mightpulse-player-api');
  const server = await createServer({ configFile: false, plugins: [plugin], server: { port: 0, host: '127.0.0.1' }, appType: 'custom' });
  t.after(() => server.close()); await server.listen();
  const methods = [];
  t.mock.method(globalThis, 'fetch', async (_, options) => { methods.push(options.method); return Response.json(status()); });
  for (const slash of ['', '/']) for (const method of ['GET', 'POST']) {
    const result = await new Promise((resolve, reject) => {
      const req = httpRequest(`http://127.0.0.1:${server.httpServer.address().port}/api/map-refresh${slash}?kid=1622&token=t_stable`, { method, headers: { 'sec-fetch-site': 'same-origin' } }, res => {
        let body = ''; res.on('data', chunk => { body += chunk; }); res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
      }); req.on('error', reject); req.end();
    });
    assert.equal(result.status, 200); assert.equal(result.body.ok, true);
  }
  assert.deepEqual(methods, ['GET', 'POST', 'GET', 'POST']);
});
