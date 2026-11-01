import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { get } from 'node:http';
import test from 'node:test';
import ts from 'typescript';

const compile = async path => ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const compiled = await compile('../api/kingdom-rankings.ts');
const guard = await compile('../src/lib/server/same-site.ts');
let serial = 0;
const moduleURL = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}#${serial++}`;
async function setup(t) {
  const previous = process.env.MIGHTPULSE_API_KEY;
  process.env.MIGHTPULSE_API_KEY = 'mock-key-only';
  t.after(() => {
    if (previous === undefined) delete process.env.MIGHTPULSE_API_KEY;
    else process.env.MIGHTPULSE_API_KEY = previous;
  });
  return (await import(moduleURL(compiled.replace('../src/lib/server/same-site.js', moduleURL(guard))))).default;
}
// Actual provider row and envelope; the sample is reduced to one row with matching count.
const realRow = { rank: 1, uid: 59104008, governor_id: 234903407, nick_name: 'theGRINreaper',
  score: 3103, kid: 1584, aid: 159300059, alliance_abbr: 'LOL',
  avatar_url: 'https://got-global-avatar.akamaized.net/avatar/example.png' };
const boardTypes = { personal_power: 3, kills: 4, hero_total: 8, research_power: 11, hero_equip: 13,
  gov_gear: 14, gov_charm: 15, pet_power: 16, mystic_trial: 20 };
const fixture = (kid = 1584, board = 'mystic_trial') => ({ ok: true, kid, limit: 100, boards: [{ key: board, type: boardTypes[board] }],
  board: { type: boardTypes[board], key: board, name: 'Mystic Trial', limit: 100, count: 1,
    captured_at: 1793493020.508331, kind: 'player', rows: [{ ...realRow, kid }] } });
const expectedRow = { rank: 1, uid: '59104008', governor_id: '234903407', nick_name: 'theGRINreaper',
  score: 3103, kid: 1584, alliance_abbr: 'LOL', avatar_url: realRow.avatar_url };
async function request(handler, url = '/api/kingdom-rankings/?kid=1584', method = 'GET', headers = {}) {
  const result = { status: 200, headers: {}, body: null, ends: 0 };
  await handler({ url, method, headers: { 'sec-fetch-site': 'same-origin', ...headers } }, {
    set statusCode(value) { result.status = value; },
    setHeader(name, value) { assert.equal(result.ends, 0); result.headers[name] = value; },
    end(value) { result.ends++; result.body = JSON.parse(value); },
  });
  return result;
}
function error(result, status, code) {
  assert.equal(result.status, status);
  assert.equal(result.ends, 1);
  assert.equal(result.body.ok, false);
  assert.equal(result.body.error, code);
  assert.match(result.body.message, /[가-힣]/);
  assert.deepEqual(Object.keys(result.body).sort(), ['error', 'message', 'ok']);
  assert.equal(result.headers['Cache-Control'], 'no-store');
  assert.match(result.headers['Content-Type'], /^application\/json/);
  assert.doesNotMatch(JSON.stringify(result), /mock-key|private-|<html/);
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('same-site, method, kingdom and missing key validation happen before fetch', async t => {
  const handler = await setup(t);
  delete process.env.MIGHTPULSE_API_KEY;
  const fetch = t.mock.method(globalThis, 'fetch', () => assert.fail('unexpected fetch'));
  for (const site of ['cross-site', 'same-site', '']) {
    error(await request(handler, undefined, 'GET', { 'sec-fetch-site': site }), 403, 'forbidden');
  }
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']) {
    const result = await request(handler, undefined, method);
    error(result, 405, 'invalid_method'); assert.equal(result.headers.Allow, 'GET');
  }
  for (const query of ['', '?kid=', '?kid=0', '?kid=00000', '?kid=10001', '?kid=100000',
    '?kid=-1', '?kid=1.1', '?kid=1e3', '?kid=+1', '?kid=%201', '?kid=1%0A',
    '?kid=1&kid=2', '?kid=https://evil.test', '?kid=../1']) {
    error(await request(handler, `/api/kingdom-rankings/${query}`), 400, 'invalid_kid');
  }
  error(await request(handler), 503, 'missing_key');
  process.env.MIGHTPULSE_API_KEY = '   ';
  error(await request(handler), 503, 'missing_key');
  assert.equal(fetch.mock.callCount(), 0);
});

test('actual response normalizes only public fields with fixed URL and server credentials', async t => {
  const handler = await setup(t);
  t.mock.timers.enable({ apis: ['Date'], now: 1_000_000 });
  process.env.MIGHTPULSE_API_KEY = ' mock-key-only ';
  const fetch = t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://api.mightpulse.com/v1/kingdoms/1584/ranks?board=mystic_trial&limit=100');
    assert.deepEqual(options.headers, { Authorization: 'Bearer mock-key-only',
      'User-Agent': 'kingshot-gongryak-site/1.0 (+https://xn--ob0bx7rdoh9mq.xyz)', Accept: 'application/json' });
    assert.equal(options.redirect, 'error'); assert.ok(options.signal instanceof AbortSignal);
    assert.deepEqual(Object.keys(options).sort(), ['headers', 'redirect', 'signal']);
    const data = fixture();
    data.private_field = 'private-secret'; data.board.private_field = 'private-secret';
    data.board.rows[0].private_field = 'private-secret';
    return Response.json(data);
  });
  const result = await request(handler,
    '/api/kingdom-rankings?kid=01584&limit=1&host=evil.test&key=private-key', 'GET',
    { authorization: 'Bearer private-client', cookie: 'private-cookie' });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { ok: true, kid: 1584, board: 'mystic_trial', captured_at: 1793493020.508331, rows: [expectedRow] });
  assert.equal(result.headers['Cache-Control'], 'public, max-age=0, s-maxage=300');
  assert.equal(result.headers.Vary, 'Sec-Fetch-Site');
  assert.doesNotMatch(JSON.stringify(result), /private-|mock-key|town_center|tc_level/);
  assert.equal(fetch.mock.callCount(), 1, 'no per-player enrichment');
});

test('unknown, empty, inherited and duplicate boards fail before credentials or fetch', async t => {
  const handler = await setup(t);
  delete process.env.MIGHTPULSE_API_KEY;
  const fetch = t.mock.method(globalThis, 'fetch', () => assert.fail('unexpected fetch'));
  for (const query of ['board=', 'board=power', 'board=all', 'board=20', 'board=MYSTIC_TRIAL',
    'board=%20kills', 'board=kills%0A', 'board=__proto__', 'board=constructor', 'board=toString',
    'board=kills&board=kills', 'board=kills&board=personal_power', 'board=&board=mystic_trial',
    'board=kills%26limit%3D1000', 'board=../kills']) {
    error(await request(handler, `/api/kingdom-rankings?kid=1584&${query}`), 400, 'invalid_board');
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test('all supported boards normalize the same row contract with one fixed-limit fetch each', async t => {
  const handler = await setup(t);
  for (const board of Object.keys(boardTypes)) {
    const fetch = t.mock.method(globalThis, 'fetch', async (url, options) => {
      assert.equal(url, `https://api.mightpulse.com/v1/kingdoms/1584/ranks?board=${board}&limit=100`);
      assert.equal(options.headers.Authorization, 'Bearer mock-key-only');
      assert.equal(options.redirect, 'error');
      return Response.json(fixture(1584, board));
    });
    const result = await request(handler, `/api/kingdom-rankings?kid=1584&board=${board}&limit=999`);
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { ok: true, kid: 1584, board, captured_at: 1793493020.508331, rows: [expectedRow] });
    assert.equal(fetch.mock.callCount(), 1, 'only the selected board is fetched');
    fetch.mock.restore();
  }
});

test('requested board key, type and kingdom must match before a snapshot can be cached', async t => {
  const handler = await setup(t);
  for (const [board, type] of Object.entries(boardTypes)) {
    const url = `/api/kingdom-rankings?kid=1584&board=${board}`;
    const otherBoard = board === 'kills' ? 'personal_power' : 'kills';
    const wrongKey = fixture(1584, board); wrongKey.board.key = otherBoard;
    const wrongType = fixture(1584, board); wrongType.board.type = boardTypes[otherBoard];
    const stringType = fixture(1584, board); stringType.board.type = String(type);
    const wrongRowKid = fixture(1584, board); wrongRowKid.board.rows[0].kid = 1585;
    for (const data of [fixture(1584, otherBoard), wrongKey, wrongType, stringType,
      fixture(1585, board), wrongRowKid]) {
      const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json(data));
      error(await request(handler, url), 502, 'upstream_error');
      assert.equal(fetch.mock.callCount(), 1); fetch.mock.restore();
    }
    const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json(fixture(1584, board)));
    assert.equal((await request(handler, url)).body.board, board);
    assert.equal(fetch.mock.callCount(), 1); fetch.mock.restore();
  }
});

test('comparison fetches only two selected-board snapshots; cache and pending isolate kid plus board', async t => {
  const handler = await setup(t);
  const finishes = new Map();
  const fetch = t.mock.method(globalThis, 'fetch', url => new Promise(resolve => {
    const parsed = new URL(url);
    const kid = Number(parsed.pathname.split('/')[3]);
    const board = parsed.searchParams.get('board');
    assert.equal(parsed.searchParams.get('limit'), '100');
    finishes.set(`${kid}:${board}`, () => {
      const data = fixture(kid, board);
      data.board.rows[0].score = boardTypes[board] * 10000 + kid;
      resolve(Response.json(data));
    });
  }));
  const left = request(handler, '/api/kingdom-rankings?kid=1584&board=personal_power');
  const right = request(handler, '/api/kingdom-rankings?kid=1585&board=personal_power');
  assert.equal(fetch.mock.callCount(), 2, 'one selected-board request per comparison kingdom');
  const changedMetric = request(handler, '/api/kingdom-rankings?kid=1584&board=kills');
  const duplicate = request(handler, '/api/kingdom-rankings?kid=01584&board=personal_power');
  assert.equal(fetch.mock.callCount(), 3, 'different boards do not deduplicate, identical pairs do');
  // Complete out of order so a later board result cannot overwrite another cache entry.
  finishes.get('1584:kills')();
  finishes.get('1585:personal_power')();
  finishes.get('1584:personal_power')();
  const results = await Promise.all([left, right, changedMetric]);
  assert.deepEqual((await duplicate).body, results[0].body);
  for (const [index, kid, board] of [[0, 1584, 'personal_power'], [1, 1585, 'personal_power'], [2, 1584, 'kills']]) {
    const result = results[index];
    assert.equal(result.status, 200); assert.equal(result.body.kid, kid); assert.equal(result.body.board, board);
    assert.equal(result.body.rows[0].score, boardTypes[board] * 10000 + kid);
    const cached = await request(handler, `/api/kingdom-rankings?kid=${kid}&board=${board}`);
    assert.deepEqual(cached.body, result.body);
  }
  assert.equal(fetch.mock.callCount(), 3);
});

test('kingdom boundaries, empty boards and full 100-row snapshots are accepted', async t => {
  const handler = await setup(t);
  const fetch = t.mock.method(globalThis, 'fetch', async url => {
    const kid = Number(new URL(url).pathname.split('/')[3]);
    const data = fixture(kid);
    data.board.rows = kid === 1 ? [] : Array.from({ length: 100 }, (_, i) => ({ ...realRow, kid, rank: i + 1 }));
    data.board.count = data.board.rows.length;
    return Response.json(data);
  });
  for (const kid of [1, 10000]) {
    const result = await request(handler, `/api/kingdom-rankings?kid=${kid}`);
    assert.equal(result.status, 200); assert.equal(result.body.kid, kid);
    assert.equal(result.body.rows.length, kid === 1 ? 0 : 100);
  }
  assert.equal(fetch.mock.callCount(), 2);
});

test('optional identifiers, text, URLs and capture timestamps are sanitized', async t => {
  for (const [uid, governor, normalized] of [
    ['00059104008', '999999999999999', ['59104008', '999999999999999']],
    ['1234567890123456', '0', [null, null]],
    [1, 999999999999999, ['1', '999999999999999']],
    [1000000000000000, Number.MAX_SAFE_INTEGER, [null, null]],
    [0, 1.5, [null, null]],
    [Number.MAX_SAFE_INTEGER + 1, {}, [null, null]],
    [undefined, null, [null, null]],
    [-1, '1e3', [null, null]],
  ]) {
    const handler = await setup(t);
    const data = fixture();
    Object.assign(data.board.rows[0], { uid, governor_id: governor, nick_name: '  the\u0000GRINreaper  ',
      alliance_abbr: '  LOL\n ', avatar_url: 'javascript:alert(1)' });
    data.board.captured_at = '1793493020';
    const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json(data));
    const result = await request(handler);
    assert.equal(result.status, 200); assert.equal(result.body.captured_at, null);
    assert.deepEqual(result.body.rows[0], { ...expectedRow, uid: normalized[0], governor_id: normalized[1], avatar_url: null });
    fetch.mock.restore();
  }
  for (const value of [undefined, {}, 'data:image/svg+xml,test', 'http://example.com/a.png',
    'https://user:pass@example.com/a.png', '/avatar.png', 'https://example.com/\nsecret']) {
    const handler = await setup(t);
    const data = fixture();
    Object.assign(data.board.rows[0], { avatar_url: value, alliance_abbr: {} });
    data.board.captured_at = -1;
    const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json(data));
    const result = await request(handler);
    assert.equal(result.status, 200); assert.equal(result.body.rows[0].avatar_url, null);
    assert.equal(result.body.rows[0].alliance_abbr, null); assert.equal(result.body.captured_at, null);
    fetch.mock.restore();
  }
});

test('malformed successes, mismatched kingdoms and boards are errors and never cached', async t => {
  const handler = await setup(t);
  const malformed = [null, [], {}, { ...fixture(), ok: false }, { ...fixture(), kid: 1585 },
    { ...fixture(), limit: 200 }, { ...fixture(), board: null }];
  for (const change of [{ key: 'power' }, { type: 1 }, { kind: 'alliance' }, { limit: 200 },
    { rows: null }, { count: 2 }, { rows: [], count: 1 },
    { rows: Array(101).fill(realRow), count: 101 }, { rows: [realRow, realRow], count: 2 }]) {
    malformed.push({ ...fixture(), board: { ...fixture().board, ...change } });
  }
  for (const row of [null, [], {}, ...[
    { rank: 0 }, { rank: 101 }, { rank: 1.5 }, { rank: '1' }, { score: '3103' },
    { score: null }, { score: -1 }, { kid: 1585 }, { kid: '1584' }, { nick_name: {} }, { nick_name: '  ' },
  ].map(change => ({ ...realRow, ...change }))]) {
    malformed.push({ ...fixture(), board: { ...fixture().board, rows: [row] } });
  }
  for (const data of malformed) {
    const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json(data));
    error(await request(handler), 502, 'upstream_error');
    assert.equal(fetch.mock.callCount(), 1); fetch.mock.restore();
  }
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response('<html>private-secret</html>'));
  error(await request(handler), 502, 'upstream_error'); fetch.mock.restore();
  t.mock.method(globalThis, 'fetch', async () => Response.json(fixture()));
  assert.equal((await request(handler)).status, 200);
});

test('auth, rate, not-found and network failures expose safe Korean errors without retries or logs', async t => {
  const handler = await setup(t);
  const logs = ['log', 'warn', 'error'].map(name => t.mock.method(console, name, () => {}));
  for (const [status, expected, code] of [[401, 502, 'upstream_auth'], [403, 502, 'upstream_auth'],
    [429, 429, 'rate_limited'], [404, 404, 'not_found'], [500, 502, 'upstream_error'], [503, 502, 'upstream_error']]) {
    const fetch = t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status,
      json() { assert.fail('provider error body read'); }, text() { assert.fail('provider error body read'); } }));
    for (let i = 0; i < 2; i++) {
      const result = await request(handler); error(result, expected, code);
      if (status === 404) assert.equal(result.body.message, '해당 왕국의 순위를 찾을 수 없습니다.');
    }
    assert.equal(fetch.mock.callCount(), 2, 'errors are not cached and requests are not retried');
    fetch.mock.restore();
  }
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('mock-key-only private-error'); });
  error(await request(handler), 502, 'upstream_error');
  assert.equal(fetch.mock.callCount(), 1);
  assert.equal(logs.reduce((sum, log) => sum + log.mock.callCount(), 0), 0);
});

test('5-minute cache and same-kingdom pending dedup use canonical kid and remaining CDN lifetime', async t => {
  const handler = await setup(t);
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 1_000_000 });
  let finish;
  const fetch = t.mock.method(globalThis, 'fetch', () => new Promise(resolve => { finish = resolve; }));
  const first = request(handler);
  const second = request(handler, '/api/kingdom-rankings?kid=01584&board=mystic_trial');
  assert.equal(fetch.mock.callCount(), 1);
  finish(Response.json(fixture()));
  const initial = await first;
  assert.deepEqual(initial.body, (await second).body);
  t.mock.timers.tick(120_000);
  const cached = await request(handler);
  assert.equal(fetch.mock.callCount(), 1); assert.deepEqual(cached.body, initial.body);
  assert.equal(cached.headers['Cache-Control'], 'public, max-age=0, s-maxage=180');
  t.mock.timers.tick(180_000);
  const refreshed = request(handler);
  assert.equal(fetch.mock.callCount(), 2);
  finish(Response.json(fixture()));
  assert.equal((await refreshed).headers['Cache-Control'], 'public, max-age=0, s-maxage=300');
});

test('30-second timeout covers fetch and body, releases pending, and ignores late work', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  for (const phase of ['fetch', 'body']) {
    const handler = await setup(t);
    let finish, signal;
    const fetch = t.mock.method(globalThis, 'fetch', (_, options) => {
      signal = options.signal;
      const work = new Promise(resolve => { finish = resolve; });
      return phase === 'fetch' ? work : Promise.resolve({ ok: true, json: () => work });
    });
    const first = request(handler), second = request(handler);
    await flush();
    t.mock.timers.tick(29_999); assert.equal(signal.aborted, false);
    t.mock.timers.tick(1);
    const result = await first;
    error(result, 504, 'timeout'); error(await second, 504, 'timeout');
    assert.equal(signal.aborted, true); assert.equal(fetch.mock.callCount(), 1);
    finish(phase === 'fetch' ? Response.json(fixture()) : fixture());
    await flush(); assert.equal(result.ends, 1);
    fetch.mock.restore();
    const nextFetch = t.mock.method(globalThis, 'fetch', async () => Response.json(fixture()));
    assert.equal((await request(handler)).status, 200);
    assert.equal(nextFetch.mock.callCount(), 1, 'late result must not enter cache'); nextFetch.mock.restore();
  }
});

test('cache is bounded to 100 kingdoms and evicts oldest success', async t => {
  const handler = await setup(t);
  const fetch = t.mock.method(globalThis, 'fetch', async url => Response.json(fixture(Number(new URL(url).pathname.split('/')[3]))));
  for (let kid = 1; kid <= 101; kid++) assert.equal((await request(handler, `/api/kingdom-rankings?kid=${kid}`)).status, 200);
  await request(handler, '/api/kingdom-rankings?kid=101');
  assert.equal(fetch.mock.callCount(), 101);
  await request(handler, '/api/kingdom-rankings?kid=1');
  assert.equal(fetch.mock.callCount(), 102);
});

test('pending cap allows dedup at capacity and releases slots after completion', async t => {
  const handler = await setup(t);
  const finishes = [];
  const fetch = t.mock.method(globalThis, 'fetch', url => new Promise(resolve => {
    finishes.push(() => resolve(Response.json(fixture(Number(new URL(url).pathname.split('/')[3])))));
  }));
  const requests = Array.from({ length: 100 }, (_, i) => request(handler, `/api/kingdom-rankings?kid=${i + 1}`));
  requests.push(request(handler, '/api/kingdom-rankings?kid=1'));
  error(await request(handler, '/api/kingdom-rankings?kid=101'), 429, 'rate_limited');
  assert.equal(fetch.mock.callCount(), 100);
  finishes.forEach(finish => finish());
  for (const result of await Promise.all(requests)) assert.equal(result.status, 200);
  const next = request(handler, '/api/kingdom-rankings?kid=101');
  assert.equal(fetch.mock.callCount(), 101); finishes.at(-1)();
  assert.equal((await next).status, 200);
});

test('same-site IP rate limit applies even to cached responses', async t => {
  const handler = await setup(t);
  t.mock.timers.enable({ apis: ['Date'], now: 1_000_000 });
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json(fixture()));
  for (let i = 0; i < 60; i++) assert.equal((await request(handler, undefined, 'GET', { 'x-real-ip': '192.0.2.1' })).status, 200);
  const result = await request(handler, undefined, 'GET', { 'x-real-ip': '192.0.2.1' });
  error(result, 429, 'rate_limited'); assert.equal(result.headers['Retry-After'], '60');
  assert.equal(fetch.mock.callCount(), 1);
});

test('Vite dev middleware serves both slash variants through the Node handler', async t => {
  await setup(t);
  const { createServer } = await import('vite');
  const { default: config } = await import('../astro.config.mjs');
  const plugin = config.vite.plugins.find(item => item.name === 'mightpulse-player-api');
  const server = await createServer({ configFile: false, plugins: [plugin], server: { port: 0, host: '127.0.0.1' }, appType: 'custom' });
  t.after(() => server.close()); await server.listen();
  const address = server.httpServer.address();
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json(fixture()));
  for (const path of ['/api/kingdom-rankings?kid=1584', '/api/kingdom-rankings/?kid=1584']) {
    const result = await new Promise((resolve, reject) => {
      get(`http://127.0.0.1:${address.port}${path}`, { headers: { 'sec-fetch-site': 'same-origin' } }, res => {
        let body = ''; res.setEncoding('utf8');
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
      }).on('error', reject);
    });
    assert.equal(result.status, 200); assert.deepEqual(result.body.rows, [expectedRow]);
  }
  assert.equal(fetch.mock.callCount(), 1);
});
