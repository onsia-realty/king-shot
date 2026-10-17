import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const compile = async path => ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const moduleURL = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const responseURL = moduleURL(await compile('../src/lib/api-response.ts'));
const { readApiJson, RateLimitError, rateLimitMessage, retryAfterSeconds } = await import(responseURL);
const localeURL = moduleURL("export const getLocale = () => 'ko';");
const { playerError } = await import(moduleURL((await compile('../src/lib/player-localization.ts'))
  .replace("'./locale'", JSON.stringify(localeURL)).replace("'./api-response'", JSON.stringify(responseURL))));

for (const body of ['<html>Vercel WAF</html>', '', '{broken', '{"ok":false}']) {
  test(`429 is recognized before reading body: ${JSON.stringify(body)}`, async t => {
    const response = new Response(body, { status: 429, headers: { 'Retry-After': '60' } });
    const json = t.mock.method(response, 'json', () => { throw new Error('must not parse'); });
    const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('must not retry'); });
    await assert.rejects(readApiJson(response), error => {
      assert.ok(error instanceof RateLimitError);
      assert.equal(error.retryAfterSeconds, 60);
      assert.equal(playerError(error.message, 'ko'), '요청이 일시적으로 제한되었습니다. 60초 후 다시 시도해 주세요.');
      assert.equal(playerError(error.message, 'en'), 'Requests are temporarily limited. Please try again after 60 seconds.');
      return true;
    });
    assert.equal(json.mock.callCount(), 0);
    assert.equal(fetch.mock.callCount(), 0);
  });
}

test('Retry-After supports HTTP dates and rejects invalid/expired durations', t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 9, 17) });
  for (const [value, expected] of [
    ['Sat, 17 Oct 2026 00:01:30 GMT', 90], ['Fri, 16 Oct 2026 00:00:00 GMT', 0],
    [' 60 ', 60], ['0', 0], ['-1', 0], ['1.5', 0], ['garbage', 0], ['9'.repeat(400), 0],
  ]) assert.equal(retryAfterSeconds(new Response(null, { headers: { 'Retry-After': value } })), expected);
  assert.equal(retryAfterSeconds(new Response()), 0);
});

test('missing Retry-After uses friendly KO/EN fallback without a fabricated wait', async () => {
  await assert.rejects(readApiJson(new Response('', { status: 429 })), error => {
    assert.equal(playerError(error.message, 'ko'), '요청이 일시적으로 제한되었습니다. 잠시 후 다시 시도해 주세요.');
    assert.equal(playerError(error.message, 'en'), 'Requests are temporarily limited. Please try again later.');
    return true;
  });
  assert.equal(rateLimitMessage('other_error', 'ko'), undefined);
});

test('success and existing JSON error payloads are unchanged', async () => {
  for (const status of [200, 400, 403, 500]) {
    const body = { ok: status === 200, message: 'existing message', results: [] };
    assert.deepEqual(await readApiJson(Response.json(body, { status })), body);
  }
  await assert.rejects(readApiJson(new Response('<html>Forbidden</html>', { status: 403 })), SyntaxError);
});
