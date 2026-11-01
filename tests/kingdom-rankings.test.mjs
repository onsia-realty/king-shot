import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setImmediate as flush } from 'node:timers/promises';
import test from 'node:test';
import ts from 'typescript';

const moduleURL = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const compile = async file => ts.transpileModule(await readFile(new URL(file, import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
// Use the same lightweight hook-host approach as stored-kingdom-map.test.mjs.
let active;
const hooks = {
  useState(initial) {
    const host = active, i = host.index++;
    if (!(i in host.slots)) host.slots[i] = typeof initial === 'function' ? initial() : initial;
    return [host.slots[i], value => { host.slots[i] = typeof value === 'function' ? value(host.slots[i]) : value; }];
  },
  useRef(initial) { return hooks.useState(() => ({ current: initial }))[0]; },
  useId() { return 'ranking-test'; },
  useEffect(fn, deps) {
    const host = active, i = host.index++, old = host.slots[i];
    if (!old || deps.some((value, j) => value !== old.deps[j])) {
      host.slots[i] = { deps, cleanup: old?.cleanup };
      host.effects.push(() => { host.slots[i].cleanup?.(); host.slots[i].cleanup = fn(); });
    }
  },
};
globalThis.__rankingHooks = hooks;
const react = moduleURL(Object.keys(hooks).map(name => `export const ${name} = (...args) => globalThis.__rankingHooks.${name}(...args);`).join('\n'));
const jsx = moduleURL('export const jsx = (type, props, key) => ({type, props, key}); export const jsxs = jsx; export const Fragment = "fragment";');
const locale = moduleURL('export const getLocale = () => globalThis.__rankingLocale ?? "ko"; export const useLocale = () => ({ locale: getLocale(), t: (ko, en, zhTW) => getLocale() === "zh-TW" ? zhTW ?? en : getLocale() === "en" ? en : ko });');
const response = moduleURL(await compile('../src/lib/api-response.ts'));
const stub = moduleURL('export default function Stub() {}');
const localization = moduleURL(imports(await compile('../src/lib/player-localization.ts'), { './locale': locale, './api-response': response }));
function imports(source, mappings) {
  return source.replace(/from (["'])(.*?)\1/g, (_, _quote, name) => {
    assert.ok(mappings[name], `Unexpected import: ${name}`);
    return `from ${JSON.stringify(mappings[name])}`;
  });
}
const rankingsURL = moduleURL(imports(await compile('../src/components/islands/KingdomRankings.tsx'), {
  react, 'react/jsx-runtime': jsx, '../../lib/locale': locale, '../../lib/api-response': response,
}));
const { default: Rankings } = await import(rankingsURL);
const { default: Lookup } = await import(moduleURL(imports(await compile('../src/components/islands/PlayerLookup.tsx'), {
  react, 'react/jsx-runtime': jsx, '../../lib/locale': locale, '../../lib/api-response': response,
  '../../lib/player-localization': localization, './ArenaHeroes': stub, './PlayerDiscovery': stub,
  './KingdomMap': stub, './KingdomRankings': rankingsURL, './KingdomComparison': stub, './PlayerLocationMap': stub,
})));
function mount(component, props = {}) {
  const host = { slots: [], effects: [], index: 0,
    render(next = props) { props = next; host.index = 0; active = host; const tree = component(props); active = null; return tree; },
    commit() { for (const effect of host.effects.splice(0)) effect(); },
    unmount() { for (const slot of host.slots) slot?.cleanup?.(); },
  };
  host.render(); host.commit(); return host;
}
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)];
}
const text = tree => typeof tree === 'string' || typeof tree === 'number' ? String(tree)
  : tree ? [tree.props?.children].flat(Infinity).map(text).join(' ') : '';
const find = (host, type) => nodes(host.render()).find(n => n.type === type);
const rows = host => nodes(host.render()).filter(n => n.type === 'li');
const input = (host, value) => find(host, 'input').props.onChange({ target: { value } });
const submit = host => find(host, 'form').props.onSubmit({ preventDefault() {} });
const row = (rank, extra = {}) => ({ rank, uid: String(100 + rank), governor_id: null, nick_name: `Player ${rank}`, score: 1000 + rank, kid: 1584, alliance_abbr: 'TAG', avatar_url: null, ...extra });
const snapshot = (extra = {}) => ({ ok: true, kid: 1584, board: 'mystic_trial', captured_at: 1_700_000_000, rows: [row(1)], ...extra });
function environment(t) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const timers = new Map();
  let timerId = 0;
  globalThis.window = {
    setTimeout(fn, ms) { const id = ++timerId; timers.set(id, { fn, ms }); return id; },
    clearTimeout(id) { timers.delete(id); },
    location: { href: 'https://local.test/player/', search: '' },
    history: { replaceState() {} },
  };
  globalThis.__rankingLocale = 'ko';
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'window', previous); else delete globalThis.window;
    delete globalThis.__rankingLocale;
  });
  return timers;
}

test('default/hinted kingdom never fetches automatically; user edits survive later profile hints', t => {
  environment(t);
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('unexpected request'); });
  const host = mount(Rankings);
  assert.equal(find(host, 'input').props.value, '1584');
  host.render({ playerKingdom: '2000' }); host.commit();
  assert.equal(find(host, 'input').props.value, '2000');
  input(host, '3000');
  host.render({ playerKingdom: '4000' }); host.commit();
  assert.equal(find(host, 'input').props.value, '3000');
  assert.equal(fetch.mock.callCount(), 0);
  assert.equal(find(mount(Rankings, { playerKingdom: '10001' }), 'input').props.value, '1584');
});

test('kingdom validation accepts inclusive bounds and sends only an explicit same-origin GET', async t => {
  environment(t);
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options }); return Response.json(snapshot({ kid: Number(url.split('=')[1]) }));
  });
  const host = mount(Rankings);
  for (const value of ['', '0', '-1', '10001', '1.5', 'abc', '1e3']) {
    input(host, value); await submit(host);
    assert.equal(find(host, 'input').props['aria-invalid'], true);
    assert.match(text(host.render()), /1~10000/);
  }
  assert.equal(calls.length, 0);
  for (const value of ['1', '10000', ' 01584 ']) { input(host, value); await submit(host); }
  assert.deepEqual(calls.map(c => c.url), ['/api/kingdom-rankings/?kid=1', '/api/kingdom-rankings/?kid=10000', '/api/kingdom-rankings/?kid=1584']);
  assert.ok(calls.every(c => (c.options.method ?? 'GET') === 'GET' && c.options.signal instanceof AbortSignal));
});

test('preserves server rank/order, real capture time, IDs and scores; caps at 100 with local display limits', async t => {
  environment(t);
  const selected = [], fixtureRows = [row(3, { governor_id: '987', score: 5 }), row(1, { score: 99999 }), row(7, { uid: null }),
    ...Array.from({ length: 102 }, (_, i) => row(i + 8))];
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json(snapshot({ rows: fixtureRows })));
  const host = mount(Rankings, { onSelect: (...args) => selected.push(args) });
  await submit(host);
  assert.equal(rows(host).length, 100);
  const buttons = rows(host).map(n => nodes(n).find(n => n.type === 'button'));
  assert.deepEqual(buttons.slice(0, 3).map(n => n.props['aria-label'].split('위')[0]), ['3', '1', '7']);
  buttons[0].props.onClick(); buttons[1].props.onClick(); buttons[2].props.onClick();
  assert.deepEqual(selected, [['987', 'governor_id'], ['101', 'uid']]);
  assert.equal(buttons[2].props.disabled, true);
  assert.match(text(rows(host)[0]), /\[\s*TAG\s*\]/);
  assert.match(text(rows(host)[0]), /5/);
  assert.equal(find(host, 'time').props.dateTime, new Date(1_700_000_000 * 1000).toISOString());
  assert.doesNotMatch(text(host.render()), /도시|TC|MightPulse/i);
  for (const limit of [10, 50, 100]) {
    find(host, 'select').props.onChange({ target: { value: String(limit) } });
    assert.equal(rows(host).length, limit);
  }
  assert.equal(fetch.mock.callCount(), 1);
});

test('new submissions clear rows immediately, abort prior fetches and ignore out-of-order success/failure', async t => {
  environment(t);
  const pending = [];
  t.mock.method(globalThis, 'fetch', (url, options) => new Promise((resolve, reject) => pending.push({ url, options, resolve, reject })));
  const host = mount(Rankings);
  const first = submit(host); pending[0].resolve(Response.json(snapshot())); await first;
  assert.equal(rows(host).length, 1);
  const stale = submit(host);
  assert.equal(rows(host).length, 0);
  assert.match(text(host.render()), /불러오고 있습니다/);
  input(host, '2'); const current = submit(host);
  assert.equal(pending[1].options.signal.aborted, true);
  pending[2].resolve(Response.json(snapshot({ kid: 2, rows: [row(9)] }))); await current;
  pending[1].resolve(Response.json(snapshot())); await stale;
  assert.match(text(host.render()), /왕국 2/);
  assert.match(text(host.render()), /Player 9/);
  const staleFailure = submit(host); const latest = submit(host);
  pending[3].reject(new Error('stale failure')); await staleFailure;
  assert.match(text(host.render()), /불러오고 있습니다/);
  pending[4].resolve(Response.json(snapshot({ kid: 2, rows: [] }))); await latest;
  assert.equal(nodes(host.render()).some(n => n.props?.role === 'alert'), false);
});

test('35-second timeout and unmount cancel work and release timers; aborted responses cannot publish', async t => {
  const timers = environment(t);
  const signals = [];
  t.mock.method(globalThis, 'fetch', (_, { signal }) => new Promise((resolve, reject) => {
    signals.push(signal); signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  }));
  const host = mount(Rankings);
  const work = submit(host);
  assert.equal([...timers.values()][0].ms, 35000);
  [...timers.values()][0].fn(); await work;
  assert.match(text(host.render()), /시간이 초과/);
  assert.equal(timers.size, 0);
  const work2 = submit(host); host.unmount(); await work2;
  assert.ok(signals.every(s => s.aborted));
  assert.equal(timers.size, 0);
});

test('localized empty, missing timestamp, API/HTML errors and rate limiting remain accessible', async t => {
  environment(t); globalThis.__rankingLocale = 'en';
  let response = Response.json(snapshot({ captured_at: null, rows: [] }));
  t.mock.method(globalThis, 'fetch', async () => response);
  const host = mount(Rankings);
  await submit(host);
  assert.match(text(host.render()), /No Mystic Trial rankings/);
  assert.match(text(host.render()), /Capture time unavailable/);
  assert.equal(find(host, 'time'), undefined);
  assert.ok(nodes(host.render()).some(n => n.props?.role === 'status'));
  for (response of [Response.json({ ok: false, error: 'upstream', message: 'MightPulse failed' }, { status: 502 }),
    new Response('<html>Bad gateway</html>', { status: 502 }),
    Response.json(snapshot({ kid: 9 })), Response.json(snapshot({ board: 'other' }))]) {
    await submit(host);
    assert.ok(nodes(host.render()).some(n => n.props?.role === 'alert'));
    assert.doesNotMatch(text(host.render()), /MightPulse|Bad gateway|\[object/);
    assert.equal(rows(host).length, 0);
  }
  response = new Response('<html>limited</html>', { status: 429, headers: { 'Retry-After': '45' } });
  await submit(host);
  assert.match(text(host.render()), /after 45 seconds/);
  globalThis.__rankingLocale = 'ko';
  assert.match(text(host.render()), /45초 후/);
});

test('portraits reject unsafe URLs and fall back to a Unicode initial after an image error', async t => {
  environment(t);
  t.mock.method(globalThis, 'fetch', async () => Response.json(snapshot({ rows: [row(1, { nick_name: '🌙Moon', avatar_url: 'https://example.test/portrait.png' })] })));
  const host = mount(Rankings); await submit(host);
  const portrait = nodes(host.render()).find(n => typeof n.type === 'function');
  const picture = mount(portrait.type, portrait.props);
  find(picture, 'img').props.onError();
  assert.equal(find(picture, 'img'), undefined);
  assert.match(text(picture.render()), /🌙/);
  for (const src of ['javascript:alert(1)', 'http://example.test/a', 'data:image/svg+xml,bad', 'bad-url', null]) {
    assert.equal(find(mount(portrait.type, { src, name: 'A' }), 'img'), undefined);
  }
});

test('Traditional Chinese ranking labels, counts, dates, errors and raw identity survive locale changes', async t => {
  environment(t);
  globalThis.__rankingLocale = 'zh-TW';
  let response = Response.json(snapshot({ rows: [row(1, { nick_name: '원본暱稱', alliance_abbr: '원盟' })] }));
  const fetch = t.mock.method(globalThis, 'fetch', async () => response);
  const host = mount(Rankings);
  assert.match(text(host.render()), /神秘試煉/);
  assert.doesNotMatch(text(host.render()), /[가-힣]/);
  await submit(host);
  const copy = text(host.render());
  assert.match(copy, /王國 1584.*已取得 1 人.*顯示 1 人/);
  assert.match(copy, /원본暱稱/); assert.match(copy, /원盟/);
  assert.doesNotMatch(copy.replaceAll('원본暱稱', '').replaceAll('원盟', ''), /[가-힣]/);
  assert.equal(text(find(host, 'time')), new Date(1_700_000_000_000).toLocaleString('zh-TW', { timeZone: 'Asia/Seoul' }));
  assert.match(rows(host)[0].props.children.props['aria-label'], /第 1 名.*查看個人資料與裝備/);
  globalThis.__rankingLocale = 'en'; assert.match(text(host.render()), /Mystic Trial/);
  globalThis.__rankingLocale = 'zh-TW'; assert.match(text(host.render()), /神秘試煉/);
  assert.equal(fetch.mock.callCount(), 1);
  response = new Response('', { status: 429, headers: { 'Retry-After': '12' } });
  await submit(host); assert.match(text(host.render()), /12 秒後重試/);
  const lookup = mount(Lookup, { heroes: {} });
  assert.deepEqual(nodes(lookup.render()).filter(n => n.props?.role === 'tab').map(text), ['搜尋暱稱', '王國地圖', '領主 ID', '神秘試煉', '王國比較']);
  lookup.unmount(); host.unmount();
});

test('five tabs support End/Home/wrapping and the fourth ranking tab still reveals profile/gear', async t => {
  environment(t);
  let focused;
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  globalThis.document = { getElementById: id => ({ focus() { focused = id; } }) };
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'document', previous); else delete globalThis.document; });
  const calls = [];
  t.mock.method(globalThis, 'fetch', async url => {
    calls.push(url); return Response.json({ ok: true, governor_id: '987', uid: '101', player: { nick_name: 'Selected governor', kid: 1584 }, gov_gear: { hidden: true } });
  });
  const host = mount(Lookup, { heroes: {} });
  const tabs = () => nodes(host.render()).filter(n => n.props?.role === 'tab');
  assert.equal(tabs().length, 5);
  assert.equal(text(tabs()[3]), '신비한 시련');
  assert.equal(text(tabs()[4]), '왕국 비교');
  assert.match(nodes(host.render()).find(n => n.props?.role === 'tablist').props.className, /grid-cols-2.*sm:grid-cols-3.*lg:grid-cols-5/);
  for (const [index, key, target] of [[0, 'End', 4], [4, 'ArrowRight', 0], [0, 'ArrowLeft', 4], [4, 'Home', 0]]) {
    tabs()[index].props.onKeyDown({ key, preventDefault() {} });
    assert.equal(tabs()[target].props['aria-selected'], true);
    assert.equal(focused, tabs()[target].props.id);
  }
  assert.equal(calls.length, 0);
  const rankingProps = nodes(host.render()).find(n => n.type === Rankings).props;
  rankingProps.onSelect('101', 'uid'); await flush();
  assert.deepEqual(calls, ['/api/player/?id=101&id_type=uid']);
  assert.match(text(host.render()), /Selected governor/);
  assert.match(text(host.render()), /영주 장비/);
  let scrolled = false;
  const profile = nodes(host.render()).find(n => n.props?.ref && n.props?.['aria-label'] === '영주 조회 결과');
  profile.props.ref.current = { scrollIntoView() { scrolled = true; } };
  host.commit();
  assert.equal(scrolled, true);
  rankingProps.onSelect('987', 'governor_id'); await flush();
  assert.equal(calls[1], '/api/player/?id=987');
  const comparisonProps = nodes(host.render()).find(n => n.props?.id === 'lookup-panel-comparison').props.children.props;
  comparisonProps.onSelect('101', 'uid'); await flush();
  assert.equal(calls[2], '/api/player/?id=101&id_type=uid');
  scrolled = false;
  const comparedProfile = nodes(host.render()).find(n => n.props?.ref && n.props?.['aria-label'] === '영주 조회 결과');
  comparedProfile.props.ref.current = { scrollIntoView() { scrolled = true; } };
  host.commit();
  assert.equal(scrolled, true);
  host.unmount();
});
