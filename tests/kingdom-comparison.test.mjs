import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setImmediate as flush } from 'node:timers/promises';
import test from 'node:test';
import ts from 'typescript';

const url = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const compile = async path => ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const helperURL = url(await compile('../src/lib/kingdom-comparison.ts'));
const { summarizeRanking, compareRankings, comparisonMetrics } = await import(helperURL);
const row = (rank, score = rank, extra = {}) => ({ rank, score, uid: String(100 + rank), governor_id: null,
  nick_name: `Player ${rank}`, kid: 1622, alliance_abbr: 'TAG', avatar_url: null, ...extra });
const fixture = (kid = 1622, board = 'personal_power', rows = Array.from({ length: 100 }, (_, i) => row(i + 1, i + 1, { kid }))) =>
  ({ ok: true, kid, board, captured_at: kid === 1622 ? 1793492880.102711 : 1793493020.508331, rows });

test('aggregation sorts by source rank without mutating it; top N independently selects each board', () => {
  const original = [row(3, 900), row(1, 10), row(2, 20)];
  const before = structuredClone(original);
  const summary = summarizeRanking(original, 2);
  assert.deepEqual(summary.rows.map(r => r.rank), [1, 2]);
  assert.equal(summary.total, 30);
  assert.deepEqual(original, before);
  const other = summarizeRanking([row(2, 15, { uid: 'different' }), row(1, 5, { uid: 'another' })], 2);
  const comparison = compareRankings(summary, other);
  assert.equal(comparison.complete, true);
  assert.equal(comparison.gap, 10);
  assert.ok(Math.abs(comparison.leftPercent - 60) < 1e-10);
});

test('missing, empty and incomplete data cannot become a zero-score opponent; valid zeros remain valid', () => {
  const full = summarizeRanking([row(1, 20), row(2, 40)], 2);
  for (const data of [null, [], [row(1, 1000)]]) {
    const partial = summarizeRanking(data, 2);
    assert.equal(partial.total, data?.length ? 1000 : null);
    assert.deepEqual(compareRankings(full, partial), { complete: false, gap: null, leftPercent: null });
  }
  const zero = summarizeRanking([row(1, 0), row(2, 0)], 2);
  assert.deepEqual(compareRankings(zero, zero), { complete: true, gap: 0, leftPercent: null });
  assert.deepEqual(compareRankings(zero, full), { complete: true, gap: 60, leftPercent: 0 });
  assert.equal(compareRankings(full, zero).leftPercent, 100);
});

// Match the project's dependency-free hook host used by the ranking/map tests.
let active;
const hooks = {
  useState(initial) {
    const host = active, index = host.index++;
    if (!(index in host.slots)) host.slots[index] = typeof initial === 'function' ? initial() : initial;
    return [host.slots[index], value => { host.slots[index] = typeof value === 'function' ? value(host.slots[index]) : value; }];
  },
  useRef(value) { return hooks.useState(() => ({ current: value }))[0]; },
  useId() { return 'comparison-test'; },
  useEffect(fn, deps) {
    const host = active, index = host.index++, old = host.slots[index];
    if (!old || deps.some((value, j) => value !== old.deps[j])) {
      host.slots[index] = { deps, cleanup: old?.cleanup };
      host.effects.push(() => { host.slots[index].cleanup?.(); host.slots[index].cleanup = fn(); });
    }
  },
};
globalThis.__comparisonHooks = hooks;
const react = url(Object.keys(hooks).map(name => `export const ${name} = (...args) => globalThis.__comparisonHooks.${name}(...args);`).join('\n'));
const jsx = url('export const jsx = (type, props, key) => ({type, props, key}); export const jsxs = jsx; export const Fragment = "fragment";');
const locale = url('export const useLocale = () => ({locale: globalThis.__comparisonLocale ?? "ko", t: (ko,en,zhTW) => globalThis.__comparisonLocale === "zh-TW" ? zhTW ?? en : globalThis.__comparisonLocale === "en" ? en : ko});');
const response = url(await compile('../src/lib/api-response.ts'));
const mappings = { react, 'react/jsx-runtime': jsx, '../../lib/locale': locale, '../../lib/api-response': response, '../../lib/kingdom-comparison': helperURL };
const { default: Comparison } = await import(url((await compile('../src/components/islands/KingdomComparison.tsx')).replace(/from (["'])(.*?)\1/g, (_, _quote, name) => {
  assert.ok(mappings[name], `Unexpected import: ${name}`); return `from ${JSON.stringify(mappings[name])}`;
})));
function mount(props = {}) {
  const host = { slots: [], effects: [], index: 0,
    render() { host.index = 0; active = host; const tree = Comparison(props); active = null; return tree; },
    unmount() { for (const slot of host.slots) slot?.cleanup?.(); },
  };
  host.render(); host.effects.splice(0).forEach(fn => fn()); return host;
}
function nodes(tree) { return !tree || typeof tree !== 'object' ? [] : [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)]; }
const text = tree => typeof tree === 'number' || typeof tree === 'string' ? String(tree) : tree ? [tree.props?.children].flat(Infinity).map(text).join(' ') : '';
const find = (host, type) => nodes(host.render()).find(n => n.type === type);
const input = (host, suffix, value) => nodes(host.render()).find(n => n.props?.id === `comparison-test-${suffix}`).props.onChange({ target: { value } });
const submit = host => find(host, 'form').props.onSubmit({ preventDefault() {} });
const heading = host => text(nodes(host.render()).find(n => n.props?.id === 'comparison-test-summary'));
function environment(t) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const timers = new Map(); let id = 0;
  globalThis.window = { setTimeout(fn, ms) { timers.set(++id, { fn, ms }); return id; }, clearTimeout(key) { timers.delete(key); } };
  globalThis.__comparisonLocale = 'ko';
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'window', previous); else delete globalThis.window; delete globalThis.__comparisonLocale; });
  return timers;
}

test('defaults never fetch, both requests start concurrently; edited values do not relabel submitted results', async t => {
  environment(t); const pending = [];
  t.mock.method(globalThis, 'fetch', (url, options) => new Promise(resolve => pending.push({ url, options, resolve })));
  const host = mount();
  assert.deepEqual(nodes(host.render()).filter(n => n.type === 'input').map(n => n.props.value), ['1622', '1736']);
  assert.equal(find(host, 'select').props.value, 'personal_power');
  assert.equal(pending.length, 0);
  const work = submit(host);
  assert.deepEqual(pending.map(p => p.url), ['/api/kingdom-rankings/?kid=1622&board=personal_power', '/api/kingdom-rankings/?kid=1736&board=personal_power']);
  assert.ok(pending.every(p => p.options.signal instanceof AbortSignal));
  input(host, 'A', '9'); input(host, 'metric', 'kills');
  assert.match(heading(host), /전투력/);
  assert.match(text(host.render()), /마지막으로 조회한/);
  pending[0].resolve(Response.json(fixture())); pending[1].resolve(Response.json(fixture(1736))); await work;
  assert.match(heading(host), /전투력/);
  assert.match(text(nodes(host.render()).find(n => n.props?.id === 'comparison-test-side-0')), /1622/);
  assert.equal(pending.length, 2);
  assert.deepEqual(nodes(host.render()).filter(n => n.type === 'time').map(n => n.props.dateTime), ['2026-11-01T00:28:00.102Z', '2026-11-01T00:30:20.508Z']);
});

test('10/50/100 are local rank slices with corresponding totals and all eight metric options', async t => {
  environment(t);
  const fetch = t.mock.method(globalThis, 'fetch', async address => Response.json(fixture(Number(new URL(address, 'https://local.test').searchParams.get('kid')))));
  const host = mount();
  assert.deepEqual(nodes(find(host, 'select')).filter(n => n.type === 'option').map(n => n.props.value), comparisonMetrics.map(m => m[0]));
  await submit(host);
  for (const [limit, total] of [[10, '55'], [50, '1,275'], [100, '5,050']]) {
    input(host, 'limit', String(limit));
    assert.equal(nodes(host.render()).filter(n => n.type === 'li').length, limit * 2);
    assert.match(heading(host), new RegExp(`상위 ${limit}명`));
    assert.ok(text(host.render()).includes(total));
  }
  assert.equal(fetch.mock.callCount(), 2);
});

test('new requests clear prior results and stale successes/failures never replace either side', async t => {
  environment(t); const pending = [];
  t.mock.method(globalThis, 'fetch', (url, options) => new Promise((resolve, reject) => pending.push({ url, options, resolve, reject })));
  const host = mount(); const first = submit(host);
  pending[0].resolve(Response.json(fixture())); pending[1].resolve(Response.json(fixture(1736))); await first;
  assert.equal(nodes(host.render()).filter(n => n.type === 'li').length, 200);
  const stale = submit(host);
  assert.equal(nodes(host.render()).filter(n => n.type === 'li').length, 0);
  input(host, 'metric', 'kills'); const latest = submit(host);
  assert.ok(pending.slice(2, 4).every(p => p.options.signal.aborted));
  pending[4].resolve(Response.json(fixture(1622, 'kills'))); pending[5].resolve(Response.json(fixture(1736, 'kills'))); await latest;
  pending[2].resolve(Response.json(fixture())); pending[3].reject(new Error('old')); await stale;
  assert.match(heading(host), /처치 수/);
  assert.equal(nodes(host.render()).filter(n => n.props?.role === 'alert').length, 0);
});

test('per-side error/empty/incomplete never reports a gap or a zero opponent and keeps the successful list', async t => {
  environment(t); let other = new Response('<html>rate limit</html>', { status: 429, headers: { 'Retry-After': '30' } });
  t.mock.method(globalThis, 'fetch', async address => address.includes('kid=1622') ? Response.json(fixture()) : other);
  const host = mount(); await submit(host);
  assert.equal(nodes(host.render()).filter(n => n.type === 'li').length, 100);
  assert.match(text(host.render()), /30초 후/);
  assert.match(text(host.render()), /불완전한 비교/);
  assert.equal(nodes(host.render()).some(n => n.props?.role === 'img'), false);
  for (const count of [0, 9]) {
    other = Response.json(fixture(1736, 'personal_power', Array.from({ length: count }, (_, i) => row(i + 1))));
    await submit(host); input(host, 'limit', '10');
    assert.match(text(host.render()), /불완전한 비교/);
    assert.equal(nodes(host.render()).some(n => n.props?.role === 'img'), false);
    if (count === 0) assert.match(text(host.render()), /수집된 랭킹이 없어/);
  }
  globalThis.__comparisonLocale = 'en';
  assert.match(text(host.render()), /Incomplete comparison/);
  assert.match(text(host.render()), /Participants vary by metric/);
  assert.doesNotMatch(text(host.render()), /승률|승리|우세|winner|win rate|MightPulse/i);
});

test('35-second timeout, explicit cancel and unmount abort both requests without late publication', async t => {
  const timers = environment(t), pending = [];
  t.mock.method(globalThis, 'fetch', (_, options) => new Promise(resolve => pending.push({ options, resolve })));
  const host = mount(); const first = submit(host);
  assert.equal([...timers.values()][0].ms, 35000);
  [...timers.values()][0].fn();
  assert.ok(pending.every(p => p.options.signal.aborted));
  assert.match(text(host.render()), /시간이 초과/);
  pending[0].resolve(Response.json(fixture())); pending[1].resolve(Response.json(fixture(1736))); await first;
  assert.equal(nodes(host.render()).filter(n => n.type === 'li').length, 0);
  const second = submit(host);
  nodes(host.render()).find(n => n.type === 'button' && text(n) === '취소').props.onClick();
  assert.match(text(host.render()), /취소했습니다/);
  pending[2].resolve(Response.json(fixture())); pending[3].resolve(Response.json(fixture(1736))); await second;
  const third = submit(host); host.unmount();
  pending[4].resolve(Response.json(fixture())); pending[5].resolve(Response.json(fixture(1736))); await third;
  assert.ok(pending.every(p => p.options.signal.aborted)); assert.equal(timers.size, 0);
});

test('selection prefers governor ID then UID; missing IDs disable rows; input validation sends nothing', async t => {
  environment(t); const selected = [];
  const fetch = t.mock.method(globalThis, 'fetch', async address => Response.json(fixture(Number(new URL(address, 'https://local.test').searchParams.get('kid')), 'personal_power', [row(1, 5, { governor_id: '987' }), row(2), row(3, 10, { uid: null })])));
  const host = mount({ onSelect: (...args) => selected.push(args) });
  input(host, 'B', '10001'); await submit(host); assert.equal(fetch.mock.callCount(), 0);
  input(host, 'B', '1584'); await submit(host);
  const buttons = nodes(host.render()).filter(n => n.type === 'button' && n.props['aria-label']);
  buttons.slice(0, 3).forEach(n => n.props.onClick());
  assert.deepEqual(selected, [['987', 'governor_id'], ['102', 'uid']]);
  assert.equal(buttons[2].props.disabled, true);
  await flush();
});

test('Traditional Chinese metric options, submitted metric, summaries, balance, errors and dates are localized', async t => {
  environment(t); globalThis.__comparisonLocale = 'zh-TW';
  let error = false;
  t.mock.method(globalThis, 'fetch', async address => {
    const params = new URL(address, 'https://local.test').searchParams;
    return error ? Response.json({ ok: false }, { status: 502 }) : Response.json(fixture(Number(params.get('kid')), params.get('board')));
  });
  const host = mount();
  const options = nodes(find(host, 'select')).filter(n => n.type === 'option').map(text);
  assert.deepEqual(options, ['戰力', '擊殺數', '研究戰力', '英雄戰力', '英雄裝備', '領主裝備', '領主寶石', '寵物戰力', '神秘試煉']);
  input(host, 'metric', 'research_power'); await submit(host);
  assert.match(heading(host), /研究戰力.*前 100 名分數比較/);
  assert.match(text(host.render()), /合計差距/);
  assert.match(nodes(host.render()).find(n => n.props?.role === 'img').props['aria-label'], /前 100 名合計占比/);
  input(host, 'metric', 'mystic_trial');
  assert.match(text(host.render()), /下方仍顯示上次查詢的王國與指標/);
  assert.match(heading(host), /研究戰力/);
  assert.doesNotMatch(text(host.render()), /[가-힣]/);
  assert.equal(text(find(host, 'time')), new Date(1793492880.102711 * 1000).toLocaleString('zh-TW', { timeZone: 'Asia/Seoul' }));
  error = true; await submit(host);
  assert.match(text(host.render()), /無法載入排名/);
  assert.match(text(host.render()), /比較資料不完整/);
  assert.doesNotMatch(text(host.render()), /[가-힣]/);
  host.unmount();
});
