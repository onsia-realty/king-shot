import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

let serial = 0;
const compile = async path => ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const moduleURL = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}#${serial++}`;
const source = await compile('../api/map-refresh.ts');
async function api() {
  const guard = moduleURL(await compile('../src/lib/server/same-site.ts'));
  const shared = moduleURL((await compile('../src/lib/server/mightpulse-discovery.ts')).replace('./same-site.js', guard));
  return (await import(moduleURL(source.replace('../src/lib/server/mightpulse-discovery.js', shared)
    .replace('../src/lib/server/same-site.js', guard)))).default;
}
const path = '/api/map-refresh?kid=1622&token=t_stable';
async function request(handler, url = path, method = 'GET', extraHeaders = {}) {
  const result = { status: 200, headers: {}, body: null, ends: 0 };
  await handler({ method, url, headers: { 'sec-fetch-site': 'same-origin', cookie: 'private-cookie',
    authorization: 'Bearer private-key', 'x-forwarded-for': 'private-ip', ...extraHeaders } }, {
    set statusCode(value) { result.status = value; },
    setHeader(key, value) { assert.equal(result.ends, 0, 'headers mutated after completion'); result.headers[key] = value; },
    end(data) { result.ends++; result.body = JSON.parse(data); },
  });
  return result;
}
const state = (over = {}) => ({ ok: true, mighty: false, kid: 1622, updates_paused: false, update_available: false,
  cooldown_remaining_sec: 1153, cooldown_total_sec: 1800, last_finished_at: 1793415207.9350095,
  job: null, queue_position: null, queue_length: 1, request_token: 't_stable',
  ip_cooldown_remaining_sec: 1130, ip_cooldown_total_sec: 1800, ...over });
function error(result, status, code) {
  assert.equal(result.status, status); assert.equal(result.ends, 1);
  assert.deepEqual(result.body, { ok: false, error: code });
  assert.equal(result.headers['Cache-Control'], 'no-store');
  assert.match(result.headers['Content-Type'], /^application\/json/);
  assert.doesNotMatch(JSON.stringify(result), /private-|<html|challenge/);
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('refresh has no DB dependency and gates methods, kingdoms and tokens before fetching', async t => {
  assert.doesNotMatch(source, /kingdom-store|DATABASE_URL|POSTGRES_URL|neon|storeHandler/);
  const handler = await api();
  const fetch = t.mock.method(globalThis, 'fetch', () => assert.fail('unexpected upstream request'));
  for (const method of ['PUT', 'HEAD', 'DELETE', 'OPTIONS']) {
    const result = await request(handler, path, method); error(result, 405, 'invalid_method');
    assert.equal(result.headers.Allow, 'GET, POST');
  }
  for (const kid of ['', '0', '10001', '1&kid=2', '1e3', '-1', '1.5', 'https://evil.test']) {
    error(await request(handler, `/api/map-refresh?kid=${kid}&token=t_stable`), 400, 'invalid_kid');
  }
  for (const suffix of ['', '&token=', '&token=a&token=b', '&token=%0Aprivate-key', '&token=..%2Fpath', `&token=${'a'.repeat(161)}`]) {
    error(await request(handler, `/api/map-refresh?kid=1622${suffix}`), 400, 'invalid_token');
  }
  for (const headers of [{ 'sec-fetch-site': 'cross-site' }, { 'sec-fetch-site': '' }]) {
    const result = await request(handler, path, 'POST', headers);
    assert.equal(result.status, 403); assert.equal(result.body.error, 'forbidden');
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test('GET returns actual status, nulls and timestamps with fixed service headers and no forwarded credentials', async t => {
  const handler = await api();
  const fetch = t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://mightpulse.com/api/map/update/status?kid=1622&token=t_stable');
    assert.equal(options.method, 'GET'); assert.equal(options.redirect, 'error'); assert.ok(options.signal instanceof AbortSignal);
    assert.deepEqual(options.headers, { 'User-Agent': 'kingshot-gongryak-site/1.0 (+https://xn--ob0bx7rdoh9mq.xyz)', Accept: 'application/json' });
    assert.deepEqual(Object.keys(options).sort(), ['headers', 'method', 'redirect', 'signal']);
    return Response.json({ ...state(), message: 'private-message', authorization: 'private-key', cookie: 'private-cookie', ip: 'private-ip' });
  });
  const result = await request(handler, '/api/map-refresh?kid=01622&token=t_stable&host=evil.test&key=private-key');
  assert.equal(result.status, 200); assert.deepEqual(result.body, state());
  assert.equal(result.headers['Cache-Control'], 'no-store'); assert.equal(result.headers['Retry-After'], undefined);
  assert.doesNotMatch(JSON.stringify(result), /private-/); assert.equal(fetch.mock.callCount(), 1);
});

test('POST preserves actual HTTP 200 cooldown without inventing queued success or Retry-After', async t => {
  const handler = await api();
  const cooldown = state({ ok: false, error: 'cooldown', cooldown_remaining_sec: 1104, ip_cooldown_remaining_sec: 1082, queue_length: 2 });
  const fetch = t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://mightpulse.com/api/map/update?kid=1622&token=t_stable');
    assert.equal(options.method, 'POST'); assert.equal(options.body, undefined);
    assert.deepEqual(options.headers, { 'User-Agent': 'kingshot-gongryak-site/1.0 (+https://xn--ob0bx7rdoh9mq.xyz)', Accept: 'application/json' });
    return Response.json({ ...cooldown, message: 'private-message 18m24s' });
  });
  const result = await request(handler, path, 'POST');
  assert.equal(result.status, 200); assert.deepEqual(result.body, cooldown);
  assert.equal(result.headers['Retry-After'], undefined); assert.equal(result.body.status, undefined);
  assert.equal(fetch.mock.callCount(), 1);
});

test('real queued/running/done jobs are allowlisted and successful HTTP status is retained', async t => {
  const handler = await api();
  for (const status of ['queued', 'running', 'done', 'failed', 'error', 'cancelled']) {
    const job = { job_id: 'job-123', status, progress_pct: 25, tiles_done: 20, tiles_total: 80 };
    const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json(state({ job: { ...job,
      secret: 'private-key', message: '<html>challenge</html>', headers: { authorization: 'private-key' } } }), { status: 202 }));
    const result = await request(handler, path, 'POST');
    assert.equal(result.status, 202); assert.deepEqual(result.body.job, job);
    assert.doesNotMatch(JSON.stringify(result), /private-|<html|challenge/); assert.equal(fetch.mock.callCount(), 1);
    fetch.mock.restore();
  }
});

test('429 JSON propagates cooldown fields and valid Retry-After seconds or HTTP date', async t => {
  const handler = await api();
  for (const retry of ['57', 'Sat, 31 Oct 2026 12:00:00 GMT']) {
    const body = state({ ok: false, error: 'ip_cooldown' });
    const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json({ ...body, message: 'private-message' }, { status: 429, headers: { 'Retry-After': retry } }));
    const result = await request(handler, path, 'POST');
    assert.equal(result.status, 429); assert.equal(result.headers['Retry-After'], retry); assert.deepEqual(result.body, body);
    assert.equal(fetch.mock.callCount(), 1); fetch.mock.restore();
  }
});

test('403 HTML is never read; 429 HTML and JSON parse errors remain safe JSON without retries', async t => {
  const handler = await api();
  for (const status of [403, 429, 500]) {
    const fetch = t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status,
      headers: new Headers({ 'content-type': 'text/html', 'Retry-After': '60' }),
      json() { assert.fail('HTML/error body read'); }, text() { assert.fail('HTML/error body read'); } }));
    const result = await request(handler, path, 'POST');
    error(result, status === 429 ? 429 : 502, status === 429 ? 'rate_limited' : 'upstream_error');
    assert.equal(result.headers['Retry-After'], '60'); assert.equal(fetch.mock.callCount(), 1); fetch.mock.restore();
  }
  for (const status of [200, 429]) {
    const fetch = t.mock.method(globalThis, 'fetch', async () => new Response('private-invalid-json', { status, headers: { 'content-type': 'application/json' } }));
    error(await request(handler, path, 'POST'), status === 429 ? 429 : 502, status === 429 ? 'rate_limited' : 'upstream_error');
    assert.equal(fetch.mock.callCount(), 1); fetch.mock.restore();
  }
});

test('malformed payloads, wrong kingdoms and unsafe fields cannot masquerade as success', async t => {
  const handler = await api();
  for (const payload of [null, [], { ok: 'true' }, state({ kid: 1601 }), state({ job: [] }), state({ job: { kid: 1601 } })]) {
    const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json(payload));
    error(await request(handler), 502, 'upstream_error'); fetch.mock.restore();
  }
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json(state({ ok: false, error: 'private-key',
    status: 'private-status', cooldown_remaining_sec: -1, progress_pct: 101, tiles_done: '10',
    mighty: 'true', request_token: '<html>private-key</html>', job: { status: 'private-status', job_id: -1, tiles_total: -1 } }),
    { headers: { 'Retry-After': 'private-key' } }));
  const result = await request(handler);
  assert.equal(result.status, 200); assert.equal(result.body.error, 'upstream_error');
  for (const key of ['status', 'cooldown_remaining_sec', 'progress_pct', 'tiles_done', 'mighty']) assert.equal(result.body[key], undefined);
  assert.deepEqual(result.body.job, {}); assert.equal(result.body.request_token, null);
  assert.equal(result.headers['Retry-After'], undefined); assert.doesNotMatch(JSON.stringify(result), /private-/);
  assert.equal(fetch.mock.callCount(), 1);
});

test('network failures return safe errors with no POST retry or token rotation', async t => {
  const handler = await api();
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('private-key private-cookie'); });
  error(await request(handler, path, 'POST'), 502, 'upstream_error');
  assert.equal(fetch.mock.callCount(), 1);
});

test('10-second timeout covers fetch and body and ignores late work without writing a second response', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const handler = await api();
  for (const phase of ['fetch', 'body']) {
    let finish, signal;
    const fetch = t.mock.method(globalThis, 'fetch', (_, options) => {
      signal = options.signal;
      const pending = new Promise(resolve => { finish = resolve; });
      return phase === 'fetch' ? pending : Promise.resolve({ ok: true, status: 200,
        headers: new Headers({ 'content-type': 'application/json', 'Retry-After': '60' }), json: () => pending });
    });
    const work = request(handler, path, 'POST'); await flush();
    t.mock.timers.tick(9999); assert.equal(signal.aborted, false);
    t.mock.timers.tick(1);
    const result = await work; error(result, 504, 'timeout'); assert.equal(signal.aborted, true);
    finish(phase === 'fetch' ? Response.json(state(), { headers: { 'Retry-After': '60' } }) : state());
    await flush(); assert.equal(result.ends, 1); assert.equal(result.headers['Retry-After'], undefined);
    assert.equal(fetch.mock.callCount(), 1); fetch.mock.restore();
  }
  t.mock.method(globalThis, 'fetch', async () => Response.json(state()));
  assert.equal((await request(handler)).status, 200);
});

test('active request cap refuses the eleventh request and releases slots afterward', async t => {
  const handler = await api();
  const pending = [];
  const fetch = t.mock.method(globalThis, 'fetch', () => new Promise(resolve => pending.push(resolve)));
  const requests = Array.from({ length: 10 }, () => request(handler));
  error(await request(handler, path, 'POST'), 429, 'rate_limited');
  assert.equal(fetch.mock.callCount(), 10);
  for (const resolve of pending) resolve(Response.json(state()));
  for (const result of await Promise.all(requests)) assert.equal(result.status, 200);
  fetch.mock.restore(); t.mock.method(globalThis, 'fetch', async () => Response.json(state()));
  assert.equal((await request(handler)).status, 200);
});
