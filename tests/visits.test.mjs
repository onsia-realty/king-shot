import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
const moduleURL = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const driver = moduleURL('export const neon = url => ({ query: (...args) => globalThis.visitQuery(url, ...args) });');
const load = async path => import(moduleURL(ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText.replace('@neondatabase/serverless', driver)));
const server = await load('../src/lib/server/visits.ts');
const client = await load('../src/lib/visits.ts');
function env(t, overrides = {}) {
  for (const [key, value] of Object.entries({ VERCEL_ENV: 'production', VISITS_ALLOW_LOCAL: '',
    DATABASE_URL: 'postgresql://test:secret@db.example/db', POSTGRES_URL: '', ...overrides })) {
    const previous = process.env[key]; process.env[key] = value;
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  }
  t.after(() => { delete globalThis.visitQuery; });
}
async function request(method = 'GET', headers = {}) {
  const result = { status: 200, headers: {}, body: null };
  await server.visitsHandler({ method, headers: { host: 'guide.example', origin: 'https://guide.example', ...headers } }, {
    set statusCode(value) { result.status = value; }, setHeader(key, value) { result.headers[key] = value; },
    end(body) { result.body = JSON.parse(body); },
  });
  return result;
}
test('KST midnight and year rollover', () => {
  assert.equal(server.kstDate(new Date('2026-12-31T14:59:59.999Z')), '2026-12-31');
  assert.equal(server.kstDate(new Date('2026-12-31T15:00:00Z')), '2027-01-01');
});
test('GET read-only; each POST counts refresh without cookies or personal data', async t => {
  env(t); let count = 0;
  globalThis.visitQuery = async (_, sql, params) => {
    assert.deepEqual(params, ['production', server.kstDate()]);
    if (sql === server.RECORD_VISIT) count++;
    else assert.equal(sql, server.READ_VISITS);
    return [{ today: String(count), total: String(count) }];
  };
  assert.equal((await request()).body.total, 0);
  for (let i = 1; i <= 3; i++) {
    const result = await request('POST', { cookie: 'unused', 'x-forwarded-for': '192.0.2.1' });
    assert.equal(result.body.total, i); assert.equal(result.headers['Set-Cookie'], undefined);
    assert.match(result.headers['Cache-Control'], /no-store/);
  }
  assert.equal((await request()).body.total, 3);
});
test('atomic additive upserts, schema uniqueness, no request DDL or reset', async () => {
  assert.ok(server.RECORD_VISIT.includes('SELECT $1, $2::date, 1 FROM total'));
  assert.ok(server.RECORD_VISIT.includes('public.visits_total.count + 1'));
  assert.ok(server.RECORD_VISIT.includes('public.visits_daily.count + 1'));
  assert.doesNotMatch(server.RECORD_VISIT, /CREATE|DELETE|TRUNCATE|SET count = 0/i);
  assert.doesNotMatch(server.READ_VISITS, /INSERT|UPDATE|CREATE/i);
  const schema = await readFile(new URL('../migrations/001_visits.sql', import.meta.url), 'utf8');
  assert.ok(schema.includes('PRIMARY KEY (namespace, day)'));
  assert.ok(schema.includes('namespace text PRIMARY KEY'));
});
test('missing config, preview, and ordinary development never query', async t => {
  env(t, { DATABASE_URL: '' }); globalThis.visitQuery = () => assert.fail('unexpected query');
  assert.equal((await request()).body.total, null);
  process.env.DATABASE_URL = 'postgresql://test@db.example/db';
  for (const mode of ['preview', 'development', '']) {
    process.env.VERCEL_ENV = mode; assert.equal((await request()).status, 503);
  }
});
test('same-origin POST and supported methods required', async t => {
  env(t); globalThis.visitQuery = () => assert.fail('unexpected query');
  for (const headers of [{ origin: undefined }, { origin: 'https://evil.example' }, { 'sec-fetch-site': 'cross-site' }])
    assert.equal((await request('POST', headers)).status, 403);
  assert.equal((await request('DELETE')).status, 405);
});
test('DATABASE_URL preferred with POSTGRES_URL fallback', async t => {
  env(t, { POSTGRES_URL: 'postgresql://fallback@db.example/db' }); let expected = process.env.DATABASE_URL;
  globalThis.visitQuery = async url => { assert.equal(url, expected); return [{ today: '4', total: '20' }]; };
  assert.equal((await request()).body.total, 20);
  process.env.DATABASE_URL = ''; expected = process.env.POSTGRES_URL;
  assert.equal((await request()).body.total, 20);
});
test('explicit local testing isolates development namespace', async t => {
  env(t, { VERCEL_ENV: 'development', VISITS_ALLOW_LOCAL: 'true' });
  globalThis.visitQuery = async (_, sql, params) => {
    assert.equal(sql, server.RECORD_VISIT); assert.equal(params[0], 'development');
    return [{ today: '1', total: '1' }];
  };
  assert.equal((await request('POST', { host: 'localhost:4321', origin: 'http://localhost:4321' })).body.total, 1);
  assert.equal((await request()).status, 503);
});
test('DB errors and malformed counters return unknown without leaking details', async t => {
  env(t);
  for (const rows of [[], [{ today: 'bad', total: '1' }], [{ today: '1', total: '-1' }],
    [{ today: '1', total: '9007199254740992' }]]) {
    globalThis.visitQuery = async () => rows;
    const result = await request(); assert.equal(result.status, 503); assert.equal(result.body.total, null);
  }
  globalThis.visitQuery = async () => { throw Error('secret failure'); };
  const result = await request(); assert.equal(result.body.today, null);
  assert.doesNotMatch(JSON.stringify(result.body), /secret/);
});
test('client sends one cookieless POST, GET for reads, never retries lost writes', async t => {
  const methods = [];
  const fetch = t.mock.method(globalThis, 'fetch', async (_, options) => {
    methods.push(options.method); assert.equal(options.credentials, 'omit');
    return Response.json({ ok: true, today: 3, total: 10, date: '2026-10-17' });
  });
  assert.equal((await client.fetchVisits(true)).total, 10); await client.fetchVisits();
  assert.deepEqual(methods, ['POST', 'GET']);
  fetch.mock.mockImplementation(async () => { throw Error('lost response'); });
  assert.equal(await client.fetchVisits(true), null); assert.equal(fetch.mock.callCount(), 3);
});
test('midnight and visible-day refresh only read without inflating access counts', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: Date.parse('2026-10-17T14:59:59Z') });
  const previous = globalThis.document;
  t.after(() => { if (previous === undefined) delete globalThis.document; else globalThis.document = previous; });
  let listener; const methods = [];
  globalThis.document = { visibilityState: 'visible', querySelector: () => ({}), querySelectorAll: () => [],
    addEventListener(name, fn) { assert.equal(name, 'visibilitychange'); listener = fn; } };
  t.mock.method(globalThis, 'fetch', async (_, options) => {
    methods.push(options.method); return Response.json({ ok: true, today: 1, total: 1, date: server.kstDate() });
  });
  const tick = () => new Promise(resolve => setImmediate(resolve));
  client.startVisitCounter(); await tick(); assert.deepEqual(methods, ['POST']);
  t.mock.timers.tick(1100); await tick(); assert.deepEqual(methods, ['POST', 'GET']);
  globalThis.document.visibilityState = 'hidden'; t.mock.timers.tick(86400000); await tick();
  assert.equal(methods.length, 2);
  globalThis.document.visibilityState = 'visible'; listener(); await tick();
  assert.deepEqual(methods, ['POST', 'GET', 'GET']); listener(); await tick(); assert.equal(methods.length, 3);
});
