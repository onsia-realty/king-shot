import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

let serial = 0;
const compile = async path => ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const moduleURL = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}#${serial++}`;
const guardSource = await compile('../src/lib/server/same-site.ts');
const discoverySource = await compile('../src/lib/server/mightpulse-discovery.ts');
// 호출마다 새 모듈 그래프를 만들어 요청 수 제한 카운터를 테스트끼리 분리한다.
const freshGuard = async () => (await import(moduleURL(guardSource))).allowRequest;
async function freshHandler(name) {
  const guard = moduleURL(guardSource);
  const discovery = moduleURL(discoverySource.replace('./same-site.js', guard));
  const source = (await compile(`../api/${name}.ts`))
    .replace('../src/lib/server/mightpulse-discovery.js', discovery).replace('../src/lib/server/same-site.js', guard);
  return (await import(moduleURL(source))).default;
}
function res(out) {
  return {
    set statusCode(value) { out.status = value; },
    setHeader(name, value) { out.headers[name] = value; },
    end(body) { out.body = JSON.parse(body); },
  };
}
function check(allowRequest, headers) {
  const out = { status: 200, headers: {}, body: undefined };
  out.allowed = allowRequest({ method: 'GET', url: '/api/player/?id=1', headers }, res(out));
  return out;
}
function forbidden(out) {
  assert.equal(out.allowed, false);
  assert.equal(out.status, 403);
  assert.deepEqual(Object.keys(out.body).sort(), ['error', 'message', 'ok']);
  assert.equal(out.body.ok, false);
  assert.equal(out.body.error, 'forbidden');
  assert.match(out.body.message, /[가-힣]/);
  assert.equal(out.headers['Cache-Control'], 'no-store');
}
const host = 'xn--ob0bx7rdoh9mq.xyz';

test('Sec-Fetch-Site same-origin passes and only varies the CDN key on that header', async () => {
  const out = check(await freshGuard(), { 'sec-fetch-site': 'same-origin', host });
  assert.equal(out.allowed, true);
  assert.equal(out.body, undefined);
  assert.equal(out.headers.Vary, 'Sec-Fetch-Site');
  assert.equal(out.headers['Vercel-CDN-Cache-Control'], undefined);
});

test('cross-site browser request is forbidden with an uncacheable 403', async () => {
  forbidden(check(await freshGuard(), { host, origin: 'https://copycat.example', 'sec-fetch-site': 'cross-site' }));
  forbidden(check(await freshGuard(), { host, referer: 'https://copycat.example/clone', 'sec-fetch-site': 'cross-site' }));
  forbidden(check(await freshGuard(), { host, origin: `https://sub.${host}`, 'sec-fetch-site': 'same-site' }));
});

test('requests without any browser headers (curl, server-to-server) are forbidden', async () => {
  const allowRequest = await freshGuard();
  forbidden(check(allowRequest, {}));
  forbidden(check(allowRequest, { host }));
  forbidden(check(allowRequest, { host, 'sec-fetch-site': 'none' }));
  forbidden(check(allowRequest, { origin: `https://${host}` }));
  forbidden(check(allowRequest, { host, origin: 'null' }));
  forbidden(check(allowRequest, { host, referer: 'not a url' }));
  forbidden(check(allowRequest, { host: '', referer: 'file:///' }));
  assert.equal(check(allowRequest, undefined).allowed, false);
});

test('legacy browsers without Sec-Fetch-Site pass via Origin or Referer host and skip the CDN cache', async () => {
  const allowRequest = await freshGuard();
  for (const headers of [
    { host, referer: `https://${host}/player/?id=241496933` },
    { host, origin: `https://${host}` },
    { host: 'LOCALHOST:4321', referer: 'http://localhost:4321/player/' },
  ]) {
    const out = check(allowRequest, headers);
    assert.equal(out.allowed, true);
    assert.equal(out.body, undefined);
    assert.equal(out.headers.Vary, 'Sec-Fetch-Site');
    assert.equal(out.headers['Vercel-CDN-Cache-Control'], 'no-store');
  }
  // Origin 이 있으면 Referer 로 넘어가지 않는다.
  forbidden(check(allowRequest, { host, origin: 'https://copycat.example', referer: `https://${host}/player/` }));
});

test('61st request from one IP inside the window is 429, other IPs and the next window are unaffected', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: 1_000_000 });
  const allowRequest = await freshGuard();
  const request = ip => check(allowRequest, { 'sec-fetch-site': 'same-origin', 'x-real-ip': ip });
  for (let n = 1; n <= 60; n++) assert.equal(request('203.0.113.7').allowed, true, `request ${n}`);
  const limited = request('203.0.113.7');
  assert.equal(limited.allowed, false);
  assert.equal(limited.status, 429);
  assert.deepEqual(Object.keys(limited.body).sort(), ['error', 'message', 'ok']);
  assert.equal(limited.body.error, 'rate_limited');
  assert.match(limited.body.message, /[가-힣]/);
  assert.equal(limited.headers['Cache-Control'], 'no-store');
  assert.equal(limited.headers['Retry-After'], '60');
  assert.equal(request('203.0.113.8').allowed, true);
  t.mock.timers.tick(59_000);
  assert.equal(request('203.0.113.7').status, 429);
  assert.equal(request('203.0.113.7').headers['Retry-After'], '1');
  t.mock.timers.tick(1_000);
  assert.equal(request('203.0.113.7').allowed, true);
});

test('IP comes from x-real-ip, else the first x-forwarded-for entry, else limiting is skipped', async () => {
  const allowRequest = await freshGuard();
  const same = { 'sec-fetch-site': 'same-origin' };
  for (let n = 0; n < 60; n++) check(allowRequest, { ...same, 'x-forwarded-for': '198.51.100.1, 10.0.0.1' });
  // 같은 첫 항목이면 뒤쪽 프록시 주소가 달라도 같은 IP 로 센다.
  assert.equal(check(allowRequest, { ...same, 'x-forwarded-for': '198.51.100.1, 10.0.0.2' }).status, 429);
  // x-real-ip 가 있으면 x-forwarded-for 보다 우선한다.
  assert.equal(check(allowRequest, { ...same, 'x-real-ip': '198.51.100.2', 'x-forwarded-for': '198.51.100.1' }).allowed, true);
  for (let n = 0; n < 200; n++) assert.equal(check(allowRequest, same).allowed, true);
});

test('forbidden requests do not use up the IP budget', async () => {
  const allowRequest = await freshGuard();
  for (let n = 0; n < 100; n++) forbidden(check(allowRequest, { 'x-real-ip': '192.0.2.9', 'sec-fetch-site': 'cross-site' }));
  for (let n = 0; n < 60; n++) assert.equal(check(allowRequest, { 'x-real-ip': '192.0.2.9', 'sec-fetch-site': 'same-origin' }).allowed, true);
});

test('IP table is capped: the oldest IP is evicted instead of growing without bound', async () => {
  const allowRequest = await freshGuard();
  const headers = ip => ({ 'sec-fetch-site': 'same-origin', 'x-real-ip': ip });
  for (let n = 0; n < 60; n++) check(allowRequest, headers('first-ip'));
  assert.equal(check(allowRequest, headers('first-ip')).status, 429);
  for (let n = 0; n < 5000; n++) check(allowRequest, headers(`ip-${n}`));
  // 가장 오래된 항목이 밀려났으므로 처음 IP 는 다시 새 윈도로 시작한다.
  assert.equal(check(allowRequest, headers('first-ip')).allowed, true);
});

test('all four endpoint handlers reject cross-site and header-less calls before any upstream fetch', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', () => assert.fail('unexpected upstream fetch'));
  const calls = {
    player: '/api/player/?id=241496933',
    search: '/api/search/?q=Zeras',
    map: '/api/map/?kid=1622',
    'map-refresh': '/api/map-refresh/?kid=1622&token=t_abc',
  };
  for (const [name, url] of Object.entries(calls)) {
    const handler = await freshHandler(name);
    for (const headers of [{ host, origin: 'https://copycat.example', 'sec-fetch-site': 'cross-site' }, {}]) {
      const out = { status: 200, headers: {}, body: undefined };
      await handler({ method: 'GET', url, headers }, res(out));
      assert.equal(out.status, 403, name);
      assert.equal(out.body.error, 'forbidden', name);
      assert.equal(out.headers['Cache-Control'], 'no-store', name);
    }
    // 같은 사이트 요청은 가드를 지나 원래 검증(400)까지 도달한다.
    const out = { status: 200, headers: {}, body: undefined };
    await handler({ method: 'GET', url: url.split('?')[0], headers: { 'sec-fetch-site': 'same-origin' } }, res(out));
    assert.equal(out.status, 400, name);
  }
  assert.equal(fetch.mock.callCount(), 0);
});
