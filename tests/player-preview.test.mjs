import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setImmediate as flush } from 'node:timers/promises';
import test from 'node:test';
import ts from 'typescript';

const url = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const compile = async file => ts.transpileModule(await readFile(new URL(file, import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const helperURL = url(await compile('../src/lib/player-preview.ts'));
const { createPlayerCache, playerCache, playerIdentity, mapPlayerResult, isFullPlayerResult,
  PLAYER_CACHE_KEY, PLAYER_CACHE_TTL, PLAYER_CACHE_LIMIT } = await import(helperURL);
const full = (uid = '101', governor_id = '201', extra = {}) => ({ ok: true, uid, governor_id,
  player: { nick_name: `Player ${uid}`, kid: 1622, x: 11, y: 22, power: 500, alliance: null },
  heroes: [], ranks: {}, gov_gear: { items: [{ name: 'Saved helmet' }] }, cached_at: 1700000000, ...extra });
const preview = (uid = '101', extra = {}) => ({ kid: 1622, updated_at: 1700001234, source: 'mightpulse',
  city: { uid, nick_name: `Map ${uid}`, power: 1234, x: 0, y: 1200, tc: 35, ...extra } });
function storage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('typed aliases normalize leading zeros without crossing UID/governor namespaces', () => {
  const cache = createPlayerCache(() => storage());
  assert.equal(playerIdentity('000101', 'uid'), 'uid:101');
  for (const bad of ['0', '000', '-1', '1.5', '1e3', '1234567890123456', {}, NaN]) assert.equal(playerIdentity(bad, 'uid'), null);
  const a = full('101', '201'), b = full('201', '101');
  assert.equal(cache.put('000101', 'uid', a), true);
  assert.equal(cache.get('201', 'uid'), undefined);
  assert.equal(cache.get('101', 'governor_id'), undefined);
  assert.equal(cache.put('201', 'uid', b), true);
  assert.equal(cache.get('101', 'uid').result, a);
  assert.equal(cache.get('201', 'governor_id').result, a);
  assert.equal(cache.get('201', 'uid').result, b);
  assert.equal(cache.get('101', 'governor_id').result, b);
});

test('only matching successful full responses are cached; map previews retain exact coordinates', () => {
  const cache = createPlayerCache(() => storage());
  const seed = mapPlayerResult(preview(), '101', 'uid');
  assert.deepEqual([seed.player.x, seed.player.y, seed.player.power, seed.player.kid], [0, 1200, 1234, 1622]);
  assert.equal(seed.player.alliance, undefined);
  assert.equal(mapPlayerResult(preview(), '201', 'uid'), null);
  assert.equal(mapPlayerResult(preview(), '101', 'governor_id'), null);
  for (const data of [seed, full('102'), full('101', '201', { ok: false }), null]) assert.equal(cache.put('101', 'uid', data), false);
  assert.equal(cache.get('101', 'uid'), undefined);
});

test('session hydration preserves source/save timestamps, expires at 30 minutes and bounds profiles to 20', () => {
  let now = 1800000000000;
  const disk = storage(), cache = createPlayerCache(() => disk, () => now);
  const source = full();
  cache.put('101', 'uid', source);
  now += 1000;
  const restored = createPlayerCache(() => disk, () => now);
  assert.equal(restored.get('201', 'governor_id').result.cached_at, 1700000000);
  assert.equal(restored.get('101', 'uid').savedAt, now - 1000);
  now += PLAYER_CACHE_TTL - 1000;
  assert.equal(restored.get('101', 'uid'), undefined);
  for (let i = 1; i <= PLAYER_CACHE_LIMIT + 1; i++) {
    now++;
    cache.put(String(i), 'uid', full(String(i), String(1000 + i)));
  }
  const saved = JSON.parse(disk.getItem(PLAYER_CACHE_KEY));
  assert.equal(saved.entries.length, 20);
  assert.equal(cache.get('1', 'uid'), undefined);
  assert.equal(cache.get('2', 'uid').result.uid, '2');
});

test('malformed cache and nested render fields are rejected; blocked storage keeps memory usable', () => {
  const now = 1800000000000;
  const corrupt = [full('101', '201', { player: { nick_name: {} } }),
    full('101', '201', { heroes: [null] }), full('101', '201', { heroes: [{ gear: {} }] }),
    full('101', '201', { heroes: [{ exclusive_gear: { slg_attr: [false] } }] }),
    full('101', '201', { gov_gear: { items: [null] } }), full('101', '201', { ranks: { power: {} } })];
  for (const result of corrupt) assert.equal(isFullPlayerResult(result), false);
  for (const value of ['{', '{}', JSON.stringify({ version: 2, entries: [] }), JSON.stringify({ version: 1, entries: [
    ...corrupt.map(result => ({ result, savedAt: now })), { result: full(), savedAt: now + 1 },
    { result: full(), savedAt: 'today' }, { result: full(), savedAt: now - PLAYER_CACHE_TTL }, null,
  ] })]) {
    const disk = storage(); disk.setItem(PLAYER_CACHE_KEY, value);
    assert.equal(createPlayerCache(() => disk, () => now).get('101', 'uid'), undefined);
  }
  const blocked = createPlayerCache(() => { throw new Error('SecurityError'); });
  assert.equal(blocked.get('101', 'uid'), undefined);
  assert.equal(blocked.put('101', 'uid', full()), true);
  assert.equal(blocked.get('201', 'governor_id').result.uid, '101');
  const quota = createPlayerCache(() => ({ getItem: () => null, setItem() { throw new Error('QuotaExceededError'); } }));
  assert.equal(quota.put('101', 'uid', full()), true);
  assert.equal(quota.get('101', 'uid').result.uid, '101');
});

test('fresh hidden equipment replaces the entire saved response under both aliases', () => {
  const disk = storage(), cache = createPlayerCache(() => disk);
  cache.put('101', 'uid', full());
  const hidden = full('101', '201', { gov_gear: { hidden: true, items: [] }, cached_at: 1700000099 });
  cache.put('201', 'governor_id', hidden);
  assert.equal(cache.get('101', 'uid').result, hidden);
  assert.deepEqual(createPlayerCache(() => disk).get('201', 'governor_id').result.gov_gear, { hidden: true, items: [] });
  assert.equal(JSON.parse(disk.getItem(PLAYER_CACHE_KEY)).entries.length, 1);
});

test('official fallback accepts structured leaderboard metadata and still validates displayed rank scalars', () => {
  const data = full('1201', '2201', { source: 'official', ranks: { power_rank: 1,
    leaderboards: [{ name: 'power', value: 1000000, kingdom_rank: 1 }] } });
  assert.equal(isFullPlayerResult(data), true);
  const disk = storage(), cache = createPlayerCache(() => disk);
  assert.equal(cache.put('1201', 'uid', data), true);
  assert.deepEqual(createPlayerCache(() => disk).get('2201', 'governor_id').result.ranks, data.ranks);
  assert.equal(isFullPlayerResult({ ...data, ranks: { power_rank: [] } }), false);
});

// As in stored-kingdom-map.test.mjs, a small hook host runs real component event
// handlers/effects with deferred network responses and no extra test dependency.
let active;
const hooks = {
  useState(initial) {
    const host = active, i = host.index++;
    if (!(i in host.slots)) host.slots[i] = typeof initial === 'function' ? initial() : initial;
    return [host.slots[i], value => { host.slots[i] = typeof value === 'function' ? value(host.slots[i]) : value; }];
  },
  useRef(initial) { return hooks.useState(() => ({ current: initial }))[0]; },
  useEffect(fn, deps) {
    const host = active, i = host.index++, old = host.slots[i];
    if (!old || deps.some((value, j) => value !== old.deps[j])) {
      host.slots[i] = { deps, cleanup: old?.cleanup };
      host.effects.push(() => { host.slots[i].cleanup?.(); host.slots[i].cleanup = fn(); });
    }
  },
};
globalThis.__playerPreviewHooks = hooks;
const react = url(Object.keys(hooks).map(name => `export const ${name} = (...args) => globalThis.__playerPreviewHooks.${name}(...args);`).join('\n'));
const jsx = url('export const jsx = (type, props, key) => ({type, props, key}); export const jsxs = jsx; export const Fragment = "fragment";');
const locale = url('export const getLocale = () => globalThis.__previewLocale ?? "en"; export const useLocale = () => ({locale: getLocale()});');
function imports(source, mappings) {
  return source.replace(/from (["'])(.*?)\1/g, (_, _quote, name) => {
    assert.ok(mappings[name], `Unexpected import: ${name}`);
    return `from ${JSON.stringify(mappings[name])}`;
  });
}
const api = url(await compile('../src/lib/api-response.ts'));
const localization = url(imports(await compile('../src/lib/player-localization.ts'), { './locale': locale, './api-response': api }));
const children = Object.fromEntries(['ArenaHeroes', 'PlayerDiscovery', 'KingdomMap', 'KingdomRankings', 'KingdomComparison', 'PlayerLocationMap']
  .map(name => [`./${name}`, url(`export default ${JSON.stringify(name)};`)]));
const { default: PlayerLookup } = await import(url(imports(await compile('../src/components/islands/PlayerLookup.tsx'), {
  react, 'react/jsx-runtime': jsx, '../../lib/locale': locale, '../../lib/api-response': api,
  '../../lib/player-localization': localization, '../../lib/player-preview': helperURL, ...children,
})));
const nodes = tree => !tree || typeof tree !== 'object' ? [] : [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)];
const text = tree => typeof tree === 'string' || typeof tree === 'number' ? String(tree)
  : tree ? [tree.props?.children].flat(Infinity).map(text).join(' ') : '';
const child = (tree, name) => nodes(tree).find(n => n.type === name);
const retry = tree => nodes(tree).find(n => n.type === 'button' && /^(Retry|다시 시도|重試)$/.test(text(n)));
const refreshButton = tree => nodes(tree).find(n => n.props?.['data-testid'] === 'player-refresh');
function mount(t, locale = 'en') {
  globalThis.__previewLocale = locale;
  const pending = [], timers = new Map(), history = [];
  const host = { slots: [], effects: [], index: 0, scrolls: 0,
    render() {
      host.index = 0; active = host; const tree = PlayerLookup({ heroes: {} }); active = null;
      for (const node of nodes(tree)) if (node.props?.ref) node.props.ref.current = { scrollIntoView() { host.scrolls++; } };
      return tree;
    },
    settle() { host.render(); for (const effect of host.effects.splice(0)) effect(); return host.render(); },
    unmount() { for (const slot of host.slots) slot?.cleanup?.(); },
  };
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    location: { search: '', href: 'https://example.com/player/' }, history: { replaceState: (...args) => history.push(args) },
    setTimeout(fn) { const id = Symbol(); timers.set(id, fn); return id; }, clearTimeout(id) { timers.delete(id); },
  } });
  t.mock.method(globalThis, 'fetch', (url, options) => new Promise((resolve, reject) => pending.push({ url, ...options, resolve, reject })));
  t.after(() => { host.unmount(); if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow); else delete globalThis.window; });
  host.settle();
  return { host, pending, history, timers,
    select(uid, seed = preview(uid)) { child(host.render(), 'KingdomMap').props.onSelect(uid, 'uid', seed); return host.settle(); },
  };
}

for (const lang of ['ko', 'en', 'zh-TW']) test(`map selection immediately shows base, placeholders and source time in ${lang}`, async t => {
  const { host, pending, select } = mount(t, lang);
  const tree = select(`31${['ko', 'en', 'zh-TW'].indexOf(lang)}`);
  assert.equal(pending.length, 1);
  assert.equal(host.scrolls, 1);
  assert.match(text(tree), /Map 31/);
  assert.match(text(tree), /1,234/);
  const location = child(tree, 'PlayerLocationMap');
  assert.equal(location.props.x, 0); assert.equal(location.props.y, 1200);
  assert.equal(location.props.mapPreview, true);
  assert.equal(location.key, undefined);
  assert.equal(child(tree, 'ArenaHeroes'), undefined);
  assert.match(text(tree), lang === 'ko' ? /상세 정보를 불러오는 중/ : lang === 'en' ? /Loading details/ : /正在載入詳細資料/);
  assert.doesNotMatch(text(tree), /No public governor|비공개로 설정|연맹 정보가 없습니다|無公開的領主/);
  assert.ok(nodes(tree).some(n => n.type === 'time' && n.props.dateTime === new Date(1700001234000).toISOString()));
  const uid = pending[0].url.match(/id=(\d+)/)[1];
  pending[0].resolve(Response.json(full(uid, `4${uid}`)));
  await flush(); const loaded = host.settle();
  assert.ok(child(loaded, 'ArenaHeroes'));
  assert.equal(child(loaded, 'PlayerLocationMap').props.mapPreview, false);
  assert.equal(host.scrolls, 1, 'latest response must not scroll again');
});

test('A → B aborts A and ignores its late response; failed B preserves its preview and retries B', async t => {
  const { host, pending, select, history } = mount(t);
  select('501'); let tree = select('502');
  assert.equal(pending[0].signal.aborted, true);
  assert.doesNotMatch(text(tree), /Map 501/);
  pending[0].resolve(Response.json(full('501', '601')));
  await flush(); tree = host.settle();
  assert.match(text(tree), /Map 502/);
  assert.equal(history.length, 0);
  assert.equal(playerCache.get('501', 'uid'), undefined);
  pending[1].reject(new Error('offline'));
  await flush(); tree = host.settle();
  assert.match(text(tree), /Map 502/);
  assert.match(text(tree), /Details could not be loaded/);
  assert.ok(retry(tree));
  retry(tree).props.onClick(); host.settle();
  assert.match(pending[2].url, /id=502&id_type=uid/);
  pending[2].resolve(Response.json(full('502', '602')));
  await flush(); tree = host.settle();
  assert.match(text(tree), /Player 502/);
  assert.equal(host.scrolls, 2, 'retry does not scroll again');
});

test('cached profiles show saved/source times during refresh, survive failure, and are fully replaced by hidden gear', async t => {
  playerCache.put('701', 'uid', full('701', '801'));
  const { host, pending, select } = mount(t);
  let tree = select('701');
  assert.match(text(tree), /Previously saved data/);
  assert.match(text(tree), /Saved helmet/);
  assert.match(text(tree), /Loading player profile/);
  assert.equal(child(tree, 'PlayerLocationMap').props.x, 11);
  assert.ok(nodes(tree).some(n => n.type === 'time' && n.props.dateTime === new Date(1700000000000).toISOString()));
  pending[0].resolve(Response.json({ ok: false }, { status: 503 }));
  await flush(); tree = host.settle();
  assert.match(text(tree), /Saved helmet/);
  retry(tree).props.onClick(); host.settle();
  pending[1].resolve(Response.json(full('701', '801', { gov_gear: { hidden: true, items: [] }, cached_at: 1700009999 })));
  await flush(); tree = host.settle();
  assert.doesNotMatch(text(tree), /Saved helmet|Previously saved data/);
  assert.equal(playerCache.get('801', 'governor_id').result.gov_gear.hidden, true);
  assert.equal(host.scrolls, 1);
  // A different player without a seed must never inherit this saved profile on failure.
  child(host.render(), 'PlayerLocationMap').props.onLookup('703'); host.settle();
  pending[2].reject(new Error('offline'));
  await flush(); tree = host.settle();
  assert.equal(child(tree, 'PlayerLocationMap'), undefined);
  assert.doesNotMatch(text(tree), /Player 701/);
  assert.ok(retry(tree));
});

test('mismatched full response is rejected and an unmounted request cannot populate the cache', async t => {
  const { host, pending, select } = mount(t);
  select('901'); pending[0].resolve(Response.json(full('902', '1902')));
  await flush(); let tree = host.settle();
  assert.match(text(tree), /Map 901/); assert.ok(retry(tree));
  assert.equal(playerCache.get('902', 'uid'), undefined);
  retry(tree).props.onClick(); host.settle(); host.unmount();
  assert.equal(pending[1].signal.aborted, true);
  pending[1].resolve(Response.json(full('901', '1901')));
  await flush();
  assert.equal(playerCache.get('901', 'uid'), undefined);
});

test('same-player reselect remains visible, rejects its prior pending response and scrolls once per selection', async t => {
  const { host, pending, select } = mount(t);
  select('1001');
  const tree = select('1001');
  assert.match(text(tree), /Map 1001/);
  assert.equal(child(tree, 'PlayerLocationMap').key, undefined);
  assert.equal(host.scrolls, 2);
  assert.equal(pending[0].signal.aborted, true);
  pending[1].resolve(Response.json(full('1001', '2001', { cached_at: 1700000999 })));
  await flush(); host.settle();
  pending[0].resolve(Response.json(full('1001', '2001', { cached_at: 1700000001 })));
  await flush(); host.settle();
  assert.equal(playerCache.get('1001', 'uid').result.cached_at, 1700000999);
  assert.equal(host.scrolls, 2);
});

test('timeout preserves map preview with retry and never reports unknown gear as hidden or empty', async t => {
  const { host, pending, select, timers } = mount(t);
  select('1101');
  [...timers.values()][0]();
  assert.equal(pending[0].signal.aborted, true);
  pending[0].reject(new DOMException('Aborted', 'AbortError'));
  await flush(); const tree = host.settle();
  assert.match(text(tree), /Map 1101/);
  assert.match(text(tree), /Details could not be loaded/);
  assert.ok(retry(tree));
  assert.equal(child(tree, 'ArenaHeroes'), undefined);
});

test('stale web GET never auto-refreshes; manual refresh uses UID/no-store, keeps profile and replaces private gear', async t => {
  const { host, pending, select } = mount(t);
  select('1301');
  pending[0].resolve(Response.json(full('1301', '2301', { source: 'web', fresh: false })));
  await flush(); let tree = host.settle(); await flush(); host.settle();
  assert.equal(pending.length, 1, 'stale web data must not trigger slow official refresh');
  assert.equal(refreshButton(tree).props.disabled, false);
  refreshButton(tree).props.onClick();
  refreshButton(tree).props.onClick(); // Same event snapshot cannot issue duplicate requests.
  tree = host.settle();
  assert.equal(pending.length, 2);
  assert.equal(pending[1].url, '/api/player/?id=1301&id_type=uid&refresh=1');
  assert.equal(pending[1].cache, 'no-store');
  assert.equal(pending[1].method ?? 'GET', 'GET');
  assert.match(text(tree), /Saved helmet/);
  assert.match(text(tree), /Reloading profile/);
  assert.ok(nodes(tree).some(n => n.type === 'time' && n.props.dateTime === new Date(1700000000000).toISOString()));
  assert.equal(refreshButton(tree).props.disabled, true);
  pending[1].resolve(Response.json(full('1301', '2301', { source: 'official', fresh: false,
    gov_gear: { hidden: true, items: [] }, ranks: { power_rank: 1, leaderboards: [{ name: 'power', value: 50, kingdom_rank: 1 }] } })));
  await flush(); tree = host.settle();
  assert.doesNotMatch(text(tree), /Saved helmet|Reloading profile|latest|최신/);
  assert.equal(playerCache.get('1301', 'uid').result.source, 'official');
  assert.equal(playerCache.get('1301', 'uid').result.gov_gear.hidden, true);
  assert.equal(pending.length, 2);
  assert.equal(host.scrolls, 1);
});

test('manual refresh 429 preserves profile and source timestamp, honors retry delay and retries refresh=1', async t => {
  const { host, pending, select, timers } = mount(t);
  select('1401'); pending[0].resolve(Response.json(full('1401', '2401', { source: 'web' })));
  await flush(); let tree = host.settle();
  refreshButton(tree).props.onClick(); host.settle();
  pending[1].resolve(new Response('', { status: 429, headers: { 'Retry-After': '3' } }));
  await flush(); tree = host.settle();
  assert.match(text(tree), /Saved helmet/);
  assert.equal(refreshButton(tree).props.disabled, true);
  assert.equal(retry(tree).props.disabled, true);
  refreshButton(tree).props.onClick();
  assert.equal(pending.length, 2);
  [...timers.values()][0](); tree = host.settle();
  assert.equal(retry(tree).props.disabled, false);
  retry(tree).props.onClick(); host.settle();
  assert.match(pending[2].url, /id=1401&id_type=uid&refresh=1$/);
  pending[2].reject(new Error('offline'));
  await flush(); tree = host.settle();
  assert.match(text(tree), /Saved helmet/);
  assert.equal(playerCache.get('1401', 'uid').result.cached_at, 1700000000);
  assert.equal(playerCache.get('1401', 'uid').result.source, 'web');
});

test('selecting B aborts pending manual refresh of A and ignores its late private response', async t => {
  const { host, pending, select } = mount(t);
  select('1501'); pending[0].resolve(Response.json(full('1501', '2501')));
  await flush(); refreshButton(host.settle()).props.onClick(); host.settle();
  select('1502');
  assert.equal(pending[1].signal.aborted, true);
  pending[1].resolve(Response.json(full('1501', '2501', { gov_gear: { hidden: true, items: [] } })));
  await flush(); const tree = host.settle();
  assert.match(text(tree), /Map 1502/);
  assert.doesNotMatch(text(tree), /Player 1501/);
  assert.equal(playerCache.get('1501', 'uid').result.gov_gear.hidden, undefined);
  assert.equal(pending[2].url, '/api/player/?id=1502&id_type=uid');
});
