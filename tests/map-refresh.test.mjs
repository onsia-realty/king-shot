import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setImmediate as tick } from 'node:timers/promises';
import test from 'node:test';
import ts from 'typescript';

const compile = async path => ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const moduleURL = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const responseURL = moduleURL(await compile('../src/lib/api-response.ts'));
const client = await import(moduleURL((await compile('../src/lib/map-refresh.ts')).replace('./api-response', responseURL)));
const fixture = (time, extra = {}) => ({ ok: true, kid: 1622, source: 'mightpulse', stale: false, partial: false,
  bounds: { min: 0, max: 1200 }, cities: [{ uid: 60629598, nick_name: 'Opendoor', x: time > 100 ? 1187 : 859, y: time > 100 ? 1193 : 353 }],
  alliances: [], updated_at: time, ...extra });
const status = (job = null, time = 100, extra = {}) => ({ ok: true, job, last_finished_at: time, update_available: true, ...extra });
async function drive(t, work, max = 65) {
  let settled = false;
  work.then(() => { settled = true; }, () => { settled = true; });
  await tick();
  for (let i = 0; i < max && !settled; i++) { t.mock.timers.tick(5000); await tick(); }
  assert.ok(settled, 'polling must terminate within its bound');
  return work;
}

for (const [extra, reason, http] of [
  [{ update_available: false, cooldown_remaining_sec: 1153, ip_cooldown_remaining_sec: 1130 }, 'cooldown', 200],
  [{ ok: false, error: 'cooldown', cooldown_remaining_sec: 19 }, 'cooldown', 200],
  [{ ok: false, error: 'ip_cooldown', ip_cooldown_remaining_sec: 19 }, 'cooldown', 429],
  [{ updates_paused: true }, 'paused', 200],
  [{ update_available: false }, 'unavailable', 200],
]) test(`preflight ${reason}/${http}/${extra.error ?? 'status'} loads a saved snapshot with NO POST`, async t => {
  const calls = [], reported = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push([url, options.method ?? 'GET']);
    return url.startsWith('/api/map/?') ? Response.json(fixture(200)) : Response.json(status(null, 100, extra), { status: http });
  });
  const result = await client.refreshMap(1622, new AbortController().signal, next => reported.push(next), 100);
  assert.equal(result.completed, false); assert.equal(result.reason, reason);
  assert.equal(result.snapshot.cities[0].x, 1187);
  assert.deepEqual(calls.map(c => c[1]), ['GET', 'GET']);
  assert.equal(calls[1][0], '/api/map/?kid=1622&fresh=1');
  assert.equal(reported.length, 1);
});

for (const http of [200, 429]) test(`ready preflight followed by HTTP ${http} cooldown does not retry POST or rotate the token`, async t => {
  const calls = [], token = client.scanToken();
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push([url, options.method ?? 'GET']);
    if (url.startsWith('/api/map/?')) return Response.json(fixture(200));
    return Response.json(options.method === 'POST'
      ? { ok: false, error: 'cooldown', cooldown_remaining_sec: 90, ip_cooldown_remaining_sec: 80, request_token: 'different_token' }
      : status(null, 100, { request_token: 'another_token' }), { status: options.method === 'POST' ? http : 200 });
  });
  const result = await client.refreshMap(1622, new AbortController().signal, () => {}, 100);
  assert.equal(result.completed, false); assert.equal(result.reason, 'cooldown');
  assert.deepEqual(calls.map(c => c[1]), ['GET', 'POST', 'GET']);
  assert.ok(calls.slice(0, 2).every(c => new URL(c[0], 'https://local.test').searchParams.get('token') === token));
  assert.equal(client.scanToken(), token);
});

for (const existing of [null, 'queued', 'running']) for (const disappear of [false, true]) {
  test(`${existing ?? 'new'} job completes ${disappear ? 'by disappearing' : 'with done'}, even with cooldown, and returns moved coordinates`, async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const calls = [], token = client.scanToken();
    let gets = 0;
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      calls.push([url, options.method ?? 'GET']);
      if (url.startsWith('/api/map/?')) return Response.json(fixture(200));
      if (options.method === 'POST') return Response.json(status({ status: 'queued', job_id: 'j1' }, 100, { cooldown_remaining_sec: 1800 }));
      gets++;
      if (gets === 1) return Response.json(status(existing ? { status: existing, job_id: 'j1' } : null, 100,
        existing ? { cooldown_remaining_sec: 1800, update_available: false } : {}));
      if (gets === 2) return Response.json(status({ status: 'running', job_id: 'j1' }, 100, { cooldown_remaining_sec: 1795 }));
      return Response.json(status(disappear ? null : { status: 'done', job_id: 'j1' }, 200,
        { cooldown_remaining_sec: 1790, ip_cooldown_remaining_sec: 1700, update_available: false, request_token: 'do_not_rotate' }));
    });
    const result = await drive(t, client.refreshMap(1622, new AbortController().signal, () => {}, 100));
    assert.equal(result.completed, true);
    assert.equal(calls.filter(c => c[1] === 'POST').length, existing ? 0 : 1);
    assert.ok(calls.filter(c => c[0].startsWith('/api/map-refresh/')).every(c => new URL(c[0], 'https://local.test').searchParams.get('token') === token));
    assert.deepEqual([client.selectedCity(result.snapshot.cities, '60629598').x, client.selectedCity(result.snapshot.cities, '60629598').y], [1187, 1193]);
    assert.equal(client.selectedCity([], 60629598), null);
  });
}

test('done waits briefly for publication of a newer snapshot', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let snapshots = 0, gets = 0, posts = 0;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url.startsWith('/api/map/?')) return Response.json(fixture(++snapshots === 1 ? 100 : 200));
    if (options.method === 'POST') { posts++; return Response.json(status({ status: 'queued', job_id: 'j1' })); }
    return Response.json(++gets === 1 ? status() : status({ status: 'done', job_id: 'j1' }, 200, { cooldown_remaining_sec: 1800 }));
  });
  const result = await drive(t, client.refreshMap(1622, new AbortController().signal, () => {}, 100));
  assert.equal(result.completed, true); assert.equal(snapshots, 2); assert.equal(posts, 1);
});

for (const snapshot of [fixture(100), fixture(200, { stale: true }), fixture(200, { partial: true }),
  fixture(200, { source: 'official_profiles' }), fixture(null)]) {
  test(`done cannot claim completion for ${JSON.stringify([snapshot.updated_at, snapshot.source, snapshot.stale, snapshot.partial])}`, async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    let gets = 0, snapshots = 0;
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      if (url.startsWith('/api/map/?')) { snapshots++; return Response.json(snapshot); }
      if (options.method === 'POST') return Response.json(status({ status: 'done', job_id: 'j1' }, 200));
      return Response.json(++gets === 1 ? status() : status({ status: 'done', job_id: 'j1' }, 200));
    });
    const result = await drive(t, client.refreshMap(1622, new AbortController().signal, () => {}, 100));
    assert.equal(result.completed, false); assert.equal(result.reason, 'unconfirmed');
    assert.ok(snapshots >= 1 && snapshots <= 3);
    assert.equal(result.snapshot.source, snapshot.source); assert.equal(result.snapshot.stale, snapshot.stale); assert.equal(result.snapshot.partial, snapshot.partial);
  });
}

test('DB timestamps are excluded from the baseline; a valid preflight finish time can establish it', async t => {
  const db = fixture(999999, { source: 'official_profiles', stale: true });
  assert.equal(client.locationTimestamp(db), null);
  assert.equal(client.locationTimestamp(fixture(100)), 100);
  t.mock.method(globalThis, 'fetch', async (url, options) => Response.json(url.startsWith('/api/map/?') ? fixture(200)
    : options.method === 'POST' ? status({ status: 'done', job_id: 'j1' }, 200) : status()));
  const result = await client.refreshMap(1622, new AbortController().signal, () => {}, client.locationTimestamp(db));
  assert.equal(result.completed, true);
});

test('done without any initial location or finish timestamp returns saved data without claiming completion', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => Response.json(url.startsWith('/api/map/?') ? fixture(200)
    : options.method === 'POST' ? status({ status: 'done', job_id: 'j1' }, 200) : { ok: true, update_available: true, job: null }));
  const result = await client.refreshMap(1622, new AbortController().signal, () => {}, null);
  assert.equal(result.completed, false); assert.equal(result.reason, 'unconfirmed');
});

test('disappearance with no finish advance never claims success; cancellation stops polling', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (_, options) => { calls++; return Response.json(options.method === 'POST' ? status({ status: 'running', job_id: 'j1' }) : status()); });
  const controller = new AbortController();
  const rejected = assert.rejects(client.refreshMap(1622, controller.signal, () => {}, 100), { name: 'AbortError' });
  await tick(); t.mock.timers.tick(5000); await tick(); controller.abort(); await rejected;
  const count = calls; t.mock.timers.tick(300000); await tick(); assert.equal(calls, count);
});

test('aborting a late preflight prevents POST even if fetch ignores abort', async t => {
  let resolve;
  const fetch = t.mock.method(globalThis, 'fetch', () => new Promise(done => { resolve = done; }));
  const controller = new AbortController();
  const rejected = assert.rejects(client.refreshMap(1622, controller.signal, () => {}, 100), { name: 'AbortError' });
  controller.abort(); resolve(Response.json(status())); await rejected;
  assert.equal(fetch.mock.callCount(), 1);
});

for (const state of [status({ status: 'done', job_id: 'j2' }, 200), status({ status: 'failed', job_id: 'j1' })]) {
  test(`a ${state.job.status}/${state.job.job_id} job is not a successful completion`, async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    let calls = 0;
    t.mock.method(globalThis, 'fetch', async () => Response.json(++calls === 1 ? status({ status: 'running', job_id: 'j1' }) : state));
    const work = assert.rejects(client.refreshMap(1622, new AbortController().signal, () => {}, 100), /scan_replaced|scan_failed/);
    await drive(t, work);
  });
}

test('joining a queue stops at its bounded attempt limit with no POST', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (_, options) => { calls.push(options.method); return Response.json(status({ status: 'queued', job_id: 'j1' })); });
  await drive(t, assert.rejects(client.refreshMap(1622, new AbortController().signal, () => {}, 100), /timeout/));
  assert.equal(calls.length, 61); assert.ok(calls.every(method => method === 'GET'));
});

test('Retry-After reaches cooldown state on non-JSON rate limits without POST', async t => {
  let calls = 0, reported;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return new Response('<html>limited</html>', { status: 429, headers: { 'Retry-After': '90' } }); });
  await assert.rejects(client.refreshMap(1622, new AbortController().signal, state => { reported = state; }, 100), /rate_limited/);
  assert.equal(calls, 1); assert.equal(reported.cooldown_remaining_sec, 90);
});

test('refresh snapshots enforce kingdom/coordinates and the same icon allowlist as initial loads', async t => {
  const data = fixture(200, { cities: [{ uid: 1, kid: 2, map_kid: 1622, x: 12, y: 20, city_skin_icon: 'https://evil.test/icon.png' }] });
  t.mock.method(globalThis, 'fetch', async () => Response.json(data));
  const result = await client.loadMapSnapshot(1622, new AbortController().signal, true);
  assert.equal(result.cities[0].city_skin_icon, null);
  assert.throws(() => client.parseMapSnapshot({ ...data, kid: 2 }, 1622), /snapshot_error/);
  assert.throws(() => client.parseMapSnapshot({ ...data, cities: [{ uid: 1, x: 1201, y: 1 }] }, 1622), /snapshot_error/);
});
