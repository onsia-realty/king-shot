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
const driver = moduleURL('export const neon = url => ({ query: (...args) => globalThis.kingdomQuery(url, ...args) });');
const storeSource = (await compile('../src/lib/server/kingdom-store.ts')).replace('@neondatabase/serverless', driver);
async function api() {
  // 핸들러마다 새 같은 사이트 검사 모듈을 물려 요청 수 제한 카운터가 테스트끼리 섞이지 않게 한다.
  const guard = moduleURL(await compile('../src/lib/server/same-site.ts'));
  const shared = moduleURL((await compile('../src/lib/server/mightpulse-discovery.ts')).replace('./same-site.js', guard));
  const store = moduleURL(storeSource.replace('./mightpulse-discovery.js', shared));
  return (await import(moduleURL((await compile('../api/map-refresh.ts')).replace('../src/lib/server/mightpulse-discovery.js', shared)
    .replace('../src/lib/server/kingdom-store.js', store)))).default;
}
function db(t, rows) {
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = 'postgresql://test:secret@db.example/db';
  t.after(() => { if (previous === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previous; delete globalThis.kingdomQuery; });
  const calls = [];
  globalThis.kingdomQuery = async (_, sql, params) => {
    calls.push([/request_count/.test(sql) ? 'request' : 'status', params]);
    return typeof rows === 'function' ? rows() : rows;
  };
  return calls;
}
async function request(handler, url, method = 'GET') {
  const headers = {};
  let body;
  const res = { statusCode: 200, setHeader(k, v) { headers[k] = v; }, end(data) { body = JSON.parse(data); } };
  await handler({ method, url, headers: { 'sec-fetch-site': 'same-origin', authorization: 'secret', cookie: 'secret', 'x-forwarded-for': 'spoof' } }, res);
  return { status: res.statusCode, headers, body };
}
const row = (over = {}) => ({ located: 0, total: 0, collected_at: null, queue_position: '2', roster: false, secret: 'row', ...over });
const fixture = time => ({ ok: true, kid: 1622, bounds: { min: 0, max: 1200 }, cities: [{ uid: 60646302, x: time > 100 ? 840 : 740, y: time > 100 ? 123 : 549 }], alliances: [], updated_at: time });
const status = (job = null, time = 100) => ({ ok: true, job, last_finished_at: time });
const tick = () => new Promise(resolve => setImmediate(resolve));

test('status validates kid and method before any query; the legacy token is optional and ignored', async t => {
  const calls = db(t, [row()]);
  const handler = await api();
  for (const kid of ['0', '10001', '1&kid=2', '1e3', '']) assert.equal((await request(handler, `/api/map-refresh?kid=${kid}&token=t_stable`, 'POST')).status, 400);
  const method = await request(handler, '/api/map-refresh?kid=1622&token=t_stable', 'PUT');
  assert.equal(method.status, 405); assert.equal(method.headers.Allow, 'GET, POST');
  assert.deepEqual(calls, []);
  for (const url of ['/api/map-refresh?kid=1622', '/api/map-refresh?kid=01622&token=t_stable', '/api/map-refresh?kid=1622&token=%0Asecret']) {
    const result = await request(handler, url);
    assert.equal(result.status, 200); assert.equal(result.body.status, 'queued'); assert.equal(result.body.kid, 1622);
  }
  assert.deepEqual(calls, [['status', [1622]], ['status', [1622]], ['status', [1622]]]);
});

test('GET reports queued or partial without claiming a completed whole-kingdom scan', async t => {
  const handler = await api();
  const expected = { ok: true, kid: 1622, job: null, request_token: null, mighty: false, updates_paused: false, update_available: false };
  for (const [rows, state] of [
    [row(), { status: 'queued', last_finished_at: null, queue_position: 2, coverage: { located: 0, total: 0, collected_at: null } }],
    [row({ roster: true }), { status: 'partial', last_finished_at: null, queue_position: 2, coverage: { located: 0, total: 0, collected_at: null } }],
    [row({ located: 40, total: 100, queue_position: 1 }), { status: 'partial', last_finished_at: null, queue_position: 1, coverage: { located: 40, total: 100, collected_at: null } }],
    [row({ located: 100, total: 100, collected_at: '1700000000', queue_position: null }), { status: 'partial', last_finished_at: 1_700_000_000, queue_position: null, coverage: { located: 100, total: 100, collected_at: 1_700_000_000 } }],
  ]) {
    db(t, [rows]);
    const result = await request(handler, '/api/map-refresh?kid=1622');
    assert.equal(result.status, 200); assert.equal(result.headers['Cache-Control'], 'no-store');
    assert.deepEqual(result.body, { ...expected, ...state });
    assert.doesNotMatch(JSON.stringify(result.body), /secret|roster/);
  }
});

test('POST records the request and answers a one-hour cooldown so the client reloads the saved map once', async t => {
  const calls = db(t, [row({ located: 100, total: 100, collected_at: 1_700_000_000, queue_position: null })]);
  const result = await request(await api(), '/api/map-refresh?kid=1622&token=t_stable', 'POST');
  assert.equal(result.status, 200); assert.equal(result.headers['Cache-Control'], 'no-store');
  assert.deepEqual(result.body, { ok: false, error: 'cooldown', kid: 1622, status: 'queued', last_finished_at: 1_700_000_000, queue_position: null,
    coverage: { located: 100, total: 100, collected_at: 1_700_000_000 }, job: null, request_token: null, mighty: false, updates_paused: false,
    update_available: false, cooldown_remaining_sec: 3600, cooldown_total_sec: 3600 });
  assert.deepEqual(calls, [['request', [1622]]]);
});

test('database failures and a missing connection string answer 503 without leaking', async t => {
  const handler = await api();
  db(t, () => { throw new Error('secret failure'); });
  const failed = await request(handler, '/api/map-refresh?kid=1622', 'POST');
  assert.equal(failed.status, 503); assert.equal(failed.body.error, 'storage_unavailable'); assert.doesNotMatch(JSON.stringify(failed.body), /secret/);
  db(t, []);
  assert.equal((await request(handler, '/api/map-refresh?kid=1622')).body.error, 'storage_unavailable');
  process.env.DATABASE_URL = '';
  globalThis.kingdomQuery = () => assert.fail('unexpected query');
  assert.equal((await request(handler, '/api/map-refresh?kid=1622')).status, 503);
});

test('client refresh against the new POST answer: one POST, cooldown reported, fresh snapshot loaded, not claimed complete', async t => {
  const calls = [];
  const reported = [];
  const before = client.scanToken();
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push([url, options.method ?? 'GET']);
    if (url.startsWith('/api/map/?')) return Response.json(fixture(200));
    const state = { ok: true, kid: 1622, status: 'done', last_finished_at: 100, queue_position: null, coverage: { located: 1, total: 1, collected_at: 100 },
      job: null, request_token: null, mighty: false, updates_paused: false, update_available: false };
    return Response.json(options.method === 'GET' ? state
      : { ...state, ok: false, error: 'cooldown', status: 'queued', cooldown_remaining_sec: 3600, cooldown_total_sec: 3600 });
  });
  const result = await client.refreshMap(1622, new AbortController().signal, state => reported.push(state), 100);
  assert.equal(result.completed, false); assert.equal(result.snapshot.cities[0].x, 840);
  assert.deepEqual(calls.map(([, method]) => method), ['GET', 'POST', 'GET']);
  assert.match(calls.at(-1)[0], /fresh=1/); assert.equal(client.scanToken(), before);
  assert.equal(reported.at(-1).cooldown_remaining_sec, 3600);
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

test('dev routing reaches the handler for status and start on both slash variants', async t => {
  const { createServer } = await import('vite');
  const { request: httpRequest } = await import('node:http');
  const { default: config } = await import('../astro.config.mjs');
  const plugin = config.vite.plugins.find(item => item.name === 'mightpulse-player-api');
  const server = await createServer({ configFile: false, plugins: [plugin], server: { port: 0, host: '127.0.0.1' }, appType: 'custom' });
  t.after(() => server.close()); await server.listen();
  // Validation answers before any database access, so routing is provable without a connection string.
  for (const slash of ['', '/']) for (const method of ['GET', 'POST']) {
    const result = await new Promise((resolve, reject) => {
      const req = httpRequest(`http://127.0.0.1:${server.httpServer.address().port}/api/map-refresh${slash}?kid=0`, { method, headers: { 'sec-fetch-site': 'same-origin' } }, res => {
        let body = ''; res.on('data', chunk => { body += chunk; }); res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
      }); req.on('error', reject); req.end();
    });
    assert.equal(result.status, 400); assert.equal(result.body.error, 'invalid_kid');
  }
});
