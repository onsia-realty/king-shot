import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setImmediate as flush } from 'node:timers/promises';
import test from 'node:test';
import ts from 'typescript';

const url = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const compile = async file => ts.transpileModule(await readFile(new URL(file, import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
// A small hook host exercises request lifecycles and event handlers without a server,
// browser, generated files, React internals, or an added test-framework dependency.
let active;
const hooks = {
  useState(initial) {
    const host = active, i = host.index++;
    if (!(i in host.slots)) host.slots[i] = typeof initial === 'function' ? initial() : initial;
    return [host.slots[i], value => { host.slots[i] = typeof value === 'function' ? value(host.slots[i]) : value; }];
  },
  useRef(initial) { return hooks.useState(() => ({ current: initial }))[0]; },
  useMemo(fn, deps) {
    const host = active, i = host.index++, old = host.slots[i];
    if (!old || deps.some((value, j) => value !== old.deps[j])) host.slots[i] = { deps, value: fn() };
    return host.slots[i].value;
  },
  useEffect(fn, deps) {
    const host = active, i = host.index++, old = host.slots[i];
    if (!old || deps.some((value, j) => value !== old.deps[j])) {
      host.slots[i] = { deps, cleanup: old?.cleanup };
      host.effects.push(() => { host.slots[i].cleanup?.(); host.slots[i].cleanup = fn(); });
    }
  },
  useId() { return 'test-id'; },
};
globalThis.__storedMapHooks = hooks;
const react = url(Object.keys(hooks).map(name => `export const ${name} = (...args) => globalThis.__storedMapHooks.${name}(...args);`).join('\n'));
const jsx = url('export const jsx = (type, props, key) => ({type, props, key}); export const jsxs = jsx; export const Fragment = "fragment";');
const locale = url('export const useLocale = () => ({ locale: globalThis.__storedMapLocale ?? "ko" });');
const localization = url('export const playerText = t => t; export const playerNumberLocale = () => "ko-KR";');
const geometry = url(await compile('../src/components/islands/mapHitGeometry.ts'));
const response = url(await compile('../src/lib/api-response.ts'));
const official = url('export default function OfficialAllianceMap() {}');
const asset = url('export default {src: "/town-center.webp"};');
function imports(source, mappings) {
  return source.replace(/from (["'])(.*?)\1/g, (whole, quote, name) => {
    assert.ok(mappings[name], `Unexpected import: ${name}`);
    return `from ${JSON.stringify(mappings[name])}`;
  });
}
const canvasURL = url(imports(await compile('../src/components/islands/KingdomMapCanvas.tsx'), {
  react, 'react/jsx-runtime': jsx, '../../lib/locale': locale,
  '../../lib/player-localization': localization, './mapHitGeometry': geometry,
  '../../assets/buildings/town-center.webp': asset,
}));
const refreshClientURL = url(imports(await compile('../src/lib/map-refresh.ts'), { './api-response': response }));
const refreshURL = url(imports(await compile('../src/components/islands/MapRefresh.tsx'), {
  react, 'react/jsx-runtime': jsx, '../../lib/locale': locale, '../../lib/api-response': response, '../../lib/map-refresh': refreshClientURL,
}));
const { default: MapRefresh, MapRefreshScope } = await import(refreshURL);
const storedURL = url(imports(await compile('../src/components/islands/StoredKingdomMap.tsx'), {
  react, 'react/jsx-runtime': jsx, '../../lib/locale': locale,
  '../../lib/api-response': response, './OfficialAllianceMap': official, './KingdomMapCanvas': canvasURL,
  '../../lib/map-refresh': refreshClientURL, './MapRefresh': refreshURL,
}));
const { fitCities, default: Canvas } = await import(canvasURL);
const { citySpriteSize, citySpriteRect } = await import(geometry);
const { default: Stored, StoredMapScope, fetchStoredMap, filterStoredCities, storedAllianceGroups, savedTime } = await import(storedURL);
const { default: KingdomMap } = await import(url(imports(await compile('../src/components/islands/KingdomMap.tsx'), {
  react, 'react/jsx-runtime': jsx, '../../lib/locale': locale, './StoredKingdomMap': storedURL,
})));
const { default: PlayerLocationMap } = await import(url(imports(await compile('../src/components/islands/PlayerLocationMap.tsx'), {
  react, 'react/jsx-runtime': jsx, '../../lib/locale': locale, './StoredKingdomMap': storedURL,
})));
function mount(component, props) {
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
const button = (tree, name) => nodes(tree).find(n => n.type === 'button' && text(n) === name);
const canvas = tree => nodes(tree).find(n => n.type === Canvas)?.props;
const refreshProps = tree => nodes(tree).find(n => n.type === MapRefresh)?.props;
const settle = host => { host.render(); host.commit(); return host.render(); };
const city = (uid, x, y, extra = {}) => ({ uid, x, y, ...extra });
const cities = [city(1, 0, 0, { aid: 11, nick_name: '달빛', alliance_abbr: 'AAA' }),
  city(2, 1200, 1200, { aid: '22', nick_name: 'Moon', alliance_abbr: 'BBB' }),
  city(3, 20, 50, { aid: '11', nick_name: 'Sun' }), city(4, 700, 600, { aid: null })];
const alliances = [{ aid: '11', abbr: 'AAA', city_count: 900 }, { aid: 22, abbr: 'BBB', city_count: 0 }];
const snapshot = (kid = 1622) => ({ ok: true, kid, bounds: { min: 0, max: 1200 }, cities, alliances,
  updated_at: 1_700_000_000, coverage: { located: 4, total: 50, collected_at: 1_700_000_001 } });
function browserTimers() {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  globalThis.window = globalThis;
  return () => { if (previous) Object.defineProperty(globalThis, 'window', previous); else delete globalThis.window; };
}

test('fit includes every projected sprite on mobile/desktop, corners, distant outliers and a single city', () => {
  const fixtures = [cities, [city(1, 0, 0)], [city(1, 1200, 1200)],
    [city(1, 0, 1200), city(2, 1200, 0)],
    [...Array.from({ length: 100 }, (_, i) => city(i, 300 + i % 10, 300 + Math.floor(i / 10))), city(101, 1200, 1200)]];
  for (const [width, height] of [[280, 420], [390, 420], [1200, 560], [800, 300]]) for (const points of fixtures) {
    const camera = fitCities(points, width, height);
    assert.ok(camera.scale > 0);
    for (const point of points) {
      const screen = { x: ((point.x - camera.x) - (point.y - camera.y)) * camera.scale / 2 + width / 2,
        y: -((point.x - camera.x) + (point.y - camera.y)) * camera.scale / 2 + height / 2 };
      const size = citySpriteSize(camera.scale), rect = citySpriteRect(screen, size, size * 1.5);
      assert.ok(rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= width && rect.y + rect.height <= height,
        JSON.stringify({ width, height, point, camera, rect }));
    }
  }
  assert.equal(fitCities([], 390, 420), undefined);
  assert.equal(fitCities(cities, 0, 0), undefined);
  assert.equal(fitCities([city(1, NaN, 0)], 390, 420), undefined);
});

test('filters search nickname/tag, normalize alliance IDs and restore all points; legend counts actual filtered cities', () => {
  assert.deepEqual(filterStoredCities(cities, alliances, '달빛', '').map(c => c.uid), [1]);
  assert.deepEqual(filterStoredCities(cities, alliances, '  aAa ', '').map(c => c.uid), [1, 3]);
  assert.deepEqual(filterStoredCities(cities, alliances, 'moon', '11'), []);
  assert.deepEqual(filterStoredCities(cities, alliances, '', 'none').map(c => c.uid), [4]);
  const restored = filterStoredCities(cities, alliances, '', '');
  assert.deepEqual(restored, cities);
  assert.deepEqual(storedAllianceGroups(restored, alliances).map(a => [a.aid, a.city_count]), [['11', 2], [0, 1], ['22', 1]]);
  assert.deepEqual(storedAllianceGroups(filterStoredCities(cities, alliances, 'sun', ''), alliances).map(a => a.city_count), [1]);
});

test('GET reload stays on our API, accepts old/new metadata and rejects invalid or cross-kingdom data', async t => {
  let body = snapshot();
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => { calls.push({ url, options }); return Response.json(body); });
  const signal = new AbortController().signal;
  assert.equal((await fetchStoredMap(1622, signal)).cities.length, 4);
  body = { ...snapshot(), source: 'official_profiles', partial: true, stale: true, extra_time: null };
  const fallback = await fetchStoredMap(1622, signal, true);
  assert.equal(fallback.partial, true);
  assert.equal(fallback.stale, true);
  assert.deepEqual(calls.map(c => c.url), ['/api/map/?kid=1622', '/api/map/?kid=1622&fresh=1']);
  assert.ok(calls.every(c => c.options.method === 'GET' && c.options.signal === signal));
  assert.equal(calls[1].options.cache, 'no-store');
  for (const invalid of [snapshot(1), { ...snapshot(), cities: [city(1, null, 0)] },
    { ...snapshot(), cities: [city(1, 1201, 0)] }, { ...snapshot(), cities: [city(1, 100, 200, { kid: 2 })] }]) {
    body = invalid; await assert.rejects(fetchStoredMap(1622, signal), e => e.issue === 'failed');
  }
});

test('map kingdom takes precedence over a visitor home kingdom, but a wrong map kingdom is rejected', async t => {
  let body;
  t.mock.method(globalThis, 'fetch', async () => Response.json(body));
  const signal = new AbortController().signal;
  for (const fields of [{ kid: 2000, homekid: 2000, map_kid: 1622 }, { homekid: 2000, map_kid: 1622 },
    { kid: 1622, homekid: 2000 }, { kid: 1622, map_kid: null }]) {
    body = { ...snapshot(), cities: [city(1, 100, 200, fields)] };
    assert.equal((await fetchStoredMap(1622, signal)).cities.length, 1);
  }
  for (const fields of [{ kid: 1622, map_kid: 2000 }, { kid: 2000, map_kid: null }, { map_kid: '1622' }]) {
    body = { ...snapshot(), cities: [city(1, 100, 200, fields)] };
    await assert.rejects(fetchStoredMap(1622, signal), e => e.issue === 'failed');
  }
});

test('restores original MightPulse skin icons only from the allowed namespace', async t => {
  const allowed = ['/assets/icons/skin_icon_6000012.png', 'https://mightpulse.com/assets/icons/skin_icon_6000460.png'];
  const denied = [null, 1, {}, 'https://evil.test/assets/icons/skin_icon_6000012.png',
    '//mightpulse.com/assets/icons/skin_icon_6000012.png', 'http://mightpulse.com/assets/icons/skin_icon_6000012.png',
    'https://mightpulse.com.evil.test/assets/icons/skin_icon_6000012.png',
    'https://user@mightpulse.com/assets/icons/skin_icon_6000012.png',
    'https://mightpulse.com:8443/assets/icons/skin_icon_6000012.png',
    '/assets/icons/../skin_icon_6000012.png', '/assets/icons/%2e%2e/skin_icon_6000012.png',
    '/assets/icons/skin_icon_6000012.png?redirect=https://evil.test', '/api/map',
    '/assets/icons/skin_icon_6000012.svg', 'data:image/png;base64,abc', 'javascript:alert(1)'];
  t.mock.method(globalThis, 'fetch', async () => Response.json({ ...snapshot(),
    cities: [...allowed, ...denied].map((path, i) => city(i + 1, 100, 200, { city_skin_icon: path })) }));
  const result = await fetchStoredMap(1622, new AbortController().signal);
  assert.deepEqual(result.cities.slice(0, allowed.length).map(c => c.city_skin_icon),
    allowed.map(path => new URL(path, 'https://mightpulse.com').href));
  assert.ok(result.cities.slice(allowed.length).every(c => c.city_skin_icon === null));
});

test('map copy shows saved time and explicit stale/partial states without suggesting local-only data', async t => {
  const restoreWindow = browserTimers();
  let body;
  t.mock.method(globalThis, 'fetch', async () => Response.json(body));
  t.after(restoreWindow);
  for (const [stale, partial] of [[false, false], [true, false], [false, true], [true, true]]) {
    body = { ...snapshot(), stale, partial };
    const host = mount(StoredMapScope, { kid: 1622, onLookup() {} });
    try {
      await flush();
      const tree = host.render(), copy = text(tree);
      assert.ok(button(tree, '지도 다시 불러오기'));
      assert.ok(copy.includes(`저장 시각: ${savedTime(body.updated_at, false)}`));
      assert.equal(copy.includes('저장된 지도 대체 표시'), stale);
      assert.equal(copy.includes('일부 좌표만 표시'), partial);
      assert.match(copy, /저장된 지도 기준으로 도시를 표시합니다. 최근 이동은 반영되지 않을 수 있습니다/);
      assert.doesNotMatch(copy, /MightPulse|수집된 좌표를 표시합니다|저장소에 있는 좌표를 다시 읽습니다|fresh=1/);
    } finally { host.unmount(); }
  }
});

test('profile view loads the whole kingdom, passes camera fallback and actual UID, and stays collapsible', () => {
  const lookup = () => {};
  const props = { kid: '1622', uid: '2', x: '50', y: '60', tag: 'BBB', onLookup: lookup };
  const host = mount(PlayerLocationMap, props);
  let tree = host.render();
  let map = nodes(tree).find(n => n.type === Stored);
  assert.equal(map.props.kid, 1622);
  assert.equal(map.props.selectedUID, '2');
  assert.deepEqual(map.props.initialFocus, { x: 50, y: 60, scale: 20 });
  assert.equal(map.props.onLookup, lookup);
  assert.equal(map.props.seedCity, undefined);
  assert.equal(map.props.initialTag, undefined);
  button(tree, '위치 지도 닫기').props.onClick();
  tree = host.render();
  assert.equal(nodes(tree).some(n => n.type === Stored), false);
  button(tree, '지도에서 위치 보기').props.onClick();
  tree = host.render({ ...props, uid: null, x: null });
  map = nodes(tree).find(n => n.type === Stored);
  assert.equal(map.props.selectedUID, undefined);
  assert.equal(map.props.initialFocus, undefined);
  tree = host.render({ ...props, kid: '0' });
  assert.equal(nodes(tree).some(n => n.type === Stored), false);
  host.unmount();
});

test('source metadata labels location timestamps separately from DB save timestamps without displaying the provider', async t => {
  const restoreWindow = browserTimers();
  let body;
  t.mock.method(globalThis, 'fetch', async () => Response.json(body));
  t.after(() => { delete globalThis.__storedMapLocale; restoreWindow(); });
  for (const lang of ['ko', 'en']) for (const source of ['mightpulse', 'official_profiles', undefined]) {
    globalThis.__storedMapLocale = lang;
    body = { ...snapshot(), source, stale: true };
    const host = mount(StoredMapScope, { kid: 1622, onLookup() {} });
    try {
      await flush();
      const tree = host.render(), copy = text(tree), upstream = source === 'mightpulse', en = lang === 'en';
      assert.ok(copy.includes(savedTime(body.updated_at, en)));
      assert.equal(copy.includes(en ? 'Map positions updated at:' : '지도 위치 갱신 시각:'), upstream);
      assert.equal(nodes(tree).some(n => n.type === 'p' && text(n).startsWith(en ? 'Saved at:' : '저장 시각:')), !upstream);
      assert.equal(copy.includes(en ? 'This is not the time of a city’s position.' : '도시 위치가 확인된 시각을 뜻하지 않습니다.'), !upstream);
      assert.doesNotMatch(copy, /mightpulse|official_profiles/i);
      assert.ok(copy.includes(en ? 'Recent moves may not be reflected.' : '최근 이동은 반영되지 않을 수 있습니다.'));
    } finally { host.unmount(); }
  }
});

test('profile selection uses map coordinates and changes UID within the same kingdom without a refetch', async t => {
  const restoreWindow = browserTimers(), lookedUp = [];
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json(snapshot()));
  const props = { kid: 1622, selectedUID: '2', initialFocus: { x: 50, y: 60, scale: 20 }, onLookup: uid => lookedUp.push(uid) };
  const host = mount(StoredMapScope, props);
  t.after(() => { host.unmount(); restoreWindow(); });
  await flush();
  host.render(); host.commit();
  let tree = host.render(), map = canvas(tree);
  assert.equal(map.cities.length, 4);
  assert.equal(map.selected.uid, 2);
  assert.deepEqual(map.focus, { x: 1200, y: 1200, scale: 20 });
  assert.equal(map.allCities.find(c => c.uid === 2).x, 1200);
  assert.equal(map.fitAllCities, true);
  assert.equal(map.preserveCameraOnUpdate, true);
  map.onLookup(map.selected);
  assert.deepEqual(lookedUp, ['2']);
  map.onClose();
  assert.equal(canvas(host.render()).selected, null);
  nodes(tree).find(n => n.type === 'select').props.onChange({ target: { value: '22' } });
  nodes(tree).find(n => n.type === 'input').props.onChange({ target: { value: 'moon' } });
  host.render({ ...props, selectedUID: '3' }); host.commit();
  tree = host.render(); map = canvas(tree);
  assert.equal(map.selected.uid, 3);
  assert.deepEqual(map.focus, { x: 20, y: 50, scale: 20 });
  assert.equal(map.cities.length, 4);
  assert.equal(fetch.mock.callCount(), 1);
  assert.equal(Stored(props).key, Stored({ ...props, selectedUID: '3' }).key);
});

test('missing profile uses a noted camera fallback without adding or overwriting a map city', async t => {
  const restoreWindow = browserTimers();
  t.mock.method(globalThis, 'fetch', async () => Response.json(snapshot()));
  const props = { kid: 1622, selectedUID: '99', initialFocus: { x: 51, y: 61, scale: 20 }, onLookup() {} };
  const host = mount(StoredMapScope, props);
  t.after(() => { host.unmount(); restoreWindow(); });
  await flush(); host.render(); host.commit();
  let tree = host.render();
  assert.equal(canvas(tree).selected, null);
  assert.deepEqual(canvas(tree).focus, props.initialFocus);
  assert.deepEqual(canvas(tree).allCities.map(c => c.uid), [1, 2, 3, 4]);
  assert.match(text(tree), /프로필 좌표는 화면 중심으로만 사용/);
  host.render({ ...props, initialFocus: { x: 70, y: 80, scale: 20 } }); host.commit();
  tree = host.render();
  assert.deepEqual(canvas(tree).focus, { x: 70, y: 80, scale: 20 });
});

test('202, storage failure and non-JSON rate limits are distinct and never imply an empty map', async t => {
  const signal = new AbortController().signal;
  for (const [status, body, issue] of [[202, { kid: 1622, error: 'not_collected', queued: true }, 'not_collected'],
    [503, null, 'storage'], [429, null, 'limited']]) {
    const mock = t.mock.method(globalThis, 'fetch', async () => new Response(body ? JSON.stringify(body) : '<html>blocked</html>', { status, headers: { 'Retry-After': '90' } }));
    await assert.rejects(fetchStoredMap(1622, signal), e => e.issue === issue
      && (status !== 202 || e.queued) && (status !== 429 || e.retryAfter === 90));
    mock.mock.restore();
  }
  assert.equal(savedTime(null, false), null);
  assert.equal(savedTime('invalid', true), null);
  assert.equal(savedTime(1_700_000_000, true), savedTime(new Date(1_700_000_000_000).toISOString(), true));
});

test('same-kingdom refresh failures keep the existing map; select-all restores filters without fetching', async t => {
  const restoreWindow = browserTimers();
  let reply = () => Response.json(snapshot());
  const fetch = t.mock.method(globalThis, 'fetch', async () => reply());
  const host = mount(StoredMapScope, { kid: 1622, onLookup() {} });
  t.after(() => { host.unmount(); restoreWindow(); });
  await flush();
  let tree = host.render(); host.commit();
  assert.equal(canvas(tree).cities.length, 4);
  assert.equal(nodes(tree).some(n => n.type?.name === 'OfficialAllianceMap'), false);
  nodes(tree).find(n => n.type === 'select').props.onChange({ target: { value: '11' } });
  nodes(tree).find(n => n.type === 'input').props.onChange({ target: { value: 'sun' } });
  tree = host.render();
  assert.deepEqual(canvas(tree).cities.map(c => c.uid), [3]);
  button(tree, '전체 선택').props.onClick();
  tree = host.render();
  assert.equal(canvas(tree).cities.length, 4);
  assert.equal(fetch.mock.callCount(), 1);
  const loaded = canvas(tree).allCities;
  for (const status of [202, 503, 429]) {
    reply = () => Response.json({ error: 'not_collected', kid: 1622, queued: status === 202 }, { status });
    button(tree, '지도 다시 불러오기').props.onClick(); await flush();
    assert.equal(fetch.mock.calls.at(-1).arguments[0], '/api/map/?kid=1622&fresh=1');
    tree = host.render(); host.commit();
    assert.equal(canvas(tree).allCities, loaded);
    assert.match(text(tree), /이전에 불러온 지도를 유지/);
  }
});

test('unmount aborts the old kingdom request; a late response cannot replace the new scope', async t => {
  const restoreWindow = browserTimers();
  const pending = [];
  t.mock.method(globalThis, 'fetch', (url, options) => new Promise(resolve => pending.push({ url, options, resolve })));
  const old = mount(StoredMapScope, { kid: 1622, onLookup() {} });
  old.unmount();
  assert.equal(pending[0].options.signal.aborted, true);
  const current = mount(StoredMapScope, { kid: 1623, onLookup() {} });
  t.after(() => { current.unmount(); restoreWindow(); });
  pending[1].resolve(Response.json(snapshot(1623))); await flush();
  const before = canvas(current.render()).allCities;
  pending[0].resolve(Response.json(snapshot())); await flush();
  assert.equal(canvas(old.render()), undefined);
  assert.equal(canvas(current.render()).allCities, before);
  assert.match(text(current.render()), /왕국 1623/);
  assert.notEqual(Stored({ kid: 1622 }).key, Stored({ kid: 1623 }).key);
});

test('editing the kingdom input or receiving a profile kingdom does not submit or replace the active map', () => {
  const host = mount(KingdomMap, { playerKingdom: '1622', onSelect() {} });
  let tree = host.render();
  nodes(tree).find(n => n.type === 'form').props.onSubmit({ preventDefault() {} });
  tree = host.render();
  assert.equal(nodes(tree).find(n => n.type === Stored).props.kid, 1622);
  nodes(tree).find(n => n.type === 'input').props.onChange({ target: { value: '1623' } });
  assert.equal(nodes(host.render()).find(n => n.type === Stored).props.kid, 1622);
  host.render({ playerKingdom: '1624', onSelect() {} }); host.commit();
  assert.equal(nodes(host.render()).find(n => n.type === Stored).props.kid, 1622);
  host.unmount();
});

for (const lang of ['ko', 'en']) test(`latest-location cooldown loads moved city without POST, with honest ${lang} copy and formatted countdown`, async t => {
  const restoreWindow = browserTimers();
  globalThis.__storedMapLocale = lang;
  let mapReads = 0;
  const calls = [];
  const moved = { ...snapshot(), source: 'mightpulse', updated_at: 1793415207.9350095,
    cities: [city(60629598, 1187, 1193, { nick_name: 'Opendoor', aid: 22 })] };
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push([url, options.method ?? 'GET']);
    if (url.startsWith('/api/map-refresh/')) return Response.json({ ok: true, kid: 1622, job: null,
      update_available: false, cooldown_remaining_sec: 759, ip_cooldown_remaining_sec: 700, last_finished_at: moved.updated_at });
    return Response.json(++mapReads === 1 ? { ...snapshot(), source: 'official_profiles', updated_at: 9999999999,
      cities: [city(60629598, 859, 353, { nick_name: 'Opendoor' })] } : moved);
  });
  const map = mount(StoredMapScope, { kid: 1622, selectedUID: '60629598', initialFocus: { x: 859, y: 353 }, onLookup() {} });
  await flush(); let tree = settle(map);
  assert.equal(refreshProps(tree).baseline, null, 'DB save time must not become a location baseline');
  const refresh = mount(MapRefreshScope, refreshProps(tree));
  t.after(() => { refresh.unmount(); map.unmount(); restoreWindow(); delete globalThis.__storedMapLocale; });
  const label = lang === 'en' ? 'Latest location' : '최신 위치 찾기';
  button(refresh.render(), label).props.onClick();
  await flush(); tree = settle(map);
  refresh.render(refreshProps(tree)); let ui = settle(refresh);
  assert.deepEqual(canvas(tree).focus, { x: 1187, y: 1193, scale: 20 });
  assert.equal(canvas(tree).selected.uid, 60629598);
  assert.ok(calls.every(c => c[1] === 'GET'));
  assert.equal(calls.length, 3);
  assert.match(text(ui), lang === 'en' ? /Please wait.*saved map/ : /다음 위치 수집까지 기다려.*저장 지도/);
  assert.match(text(ui), lang === 'en' ? /12m 39s/ : /12분 39초/);
  assert.match(text(ui), /Opendoor · X: 1187, Y: 1193/);
  assert.ok(text(ui).includes(savedTime(moved.updated_at, lang === 'en')));
  assert.ok(button(ui, label).props.disabled);
  assert.equal(button(ui, lang === 'en' ? 'Reload map' : '지도 다시 불러오기').props.disabled, false);
  const summary = nodes(ui).find(n => n.props?.['data-testid'] === 'map-location-summary');
  assert.match(summary.props.className, /basis-full/);
  assert.doesNotMatch(text(ui), /MightPulse|수집기가 주기적으로|재수집을 요청했습니다|Scan completed|수집이 완료/);
});

test('completed refresh clears conflicting filters, moves the selected profile, and reports disappearance without old profile coordinates', async t => {
  const restoreWindow = browserTimers();
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let reads = 0, posts = 0, statusGets = 0, disappeared = false;
  const base = { ...snapshot(), source: 'mightpulse', updated_at: 100 };
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url.startsWith('/api/map/?')) return Response.json(++reads === 1 ? base : {
      ...base, updated_at: disappeared ? 300 : 200,
      cities: disappeared ? cities.filter(c => c.uid !== 2) : cities.map(c => c.uid === 2 ? { ...c, x: 1187, y: 1193 } : c),
    });
    if (options.method === 'POST') { posts++; return Response.json({ ok: true, job: { status: 'running', job_id: `j${posts}` }, cooldown_remaining_sec: 1 }); }
    return Response.json(++statusGets % 2 === 1 ? { ok: true, update_available: true, last_finished_at: disappeared ? 200 : 100 }
      : { ok: true, job: null, last_finished_at: disappeared ? 300 : 200, cooldown_remaining_sec: 1 });
  });
  const props = { kid: 1622, selectedUID: '2', initialFocus: { x: 50, y: 60 }, onLookup() {} };
  const map = mount(StoredMapScope, props);
  await flush(); let tree = settle(map);
  nodes(tree).find(n => n.type === 'select').props.onChange({ target: { value: '11' } });
  nodes(tree).find(n => n.type === 'input').props.onChange({ target: { value: 'sun' } });
  tree = settle(map);
  const refresh = mount(MapRefreshScope, refreshProps(tree));
  t.after(() => { refresh.unmount(); map.unmount(); restoreWindow(); });
  button(refresh.render(), '최신 위치 찾기').props.onClick();
  await flush(); t.mock.timers.tick(5000); await flush();
  tree = settle(map); refresh.render(refreshProps(tree)); let ui = settle(refresh);
  assert.equal(posts, 1); assert.equal(canvas(tree).cities.length, 4);
  assert.deepEqual(canvas(tree).focus, { x: 1187, y: 1193, scale: 20 });
  assert.equal(canvas(tree).selected.uid, 2);
  assert.match(text(ui), /지도 수집이 완료/);
  assert.match(text(ui), /Moon · X: 1187, Y: 1193/);
  // A newly scoped explicit request models a later permitted click, without waiting on real cooldown.
  refresh.unmount(); disappeared = true;
  const next = mount(MapRefreshScope, refreshProps(tree));
  t.after(() => next.unmount());
  button(next.render(), '최신 위치 찾기').props.onClick();
  await flush(); t.mock.timers.tick(5000); await flush();
  tree = settle(map); next.render(refreshProps(tree)); ui = settle(next);
  assert.equal(posts, 2); assert.equal(canvas(tree).selected, null); assert.equal(canvas(tree).focus, null);
  assert.match(text(ui), /UID 2를 찾지 못했습니다. 현재 위치를 알 수 없습니다/);
  assert.doesNotMatch(text(tree), /프로필 좌표는 화면 중심으로만 사용/);
  assert.equal(canvas(tree).cities.some(c => c.uid === 2), false);
});

test('busy scan blocks reload synchronously; cancellation releases the lock and prevents a late POST', async t => {
  const restoreWindow = browserTimers(), pending = [], calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push([url, options.method ?? 'GET']);
    if (url.startsWith('/api/map-refresh/')) return new Promise(resolve => pending.push({ resolve, signal: options.signal }));
    return Response.json(snapshot());
  });
  const map = mount(StoredMapScope, { kid: 1622, onLookup() {} });
  await flush(); const tree = settle(map);
  const refresh = mount(MapRefreshScope, refreshProps(tree));
  t.after(() => { refresh.unmount(); map.unmount(); restoreWindow(); });
  const start = button(refresh.render(), '지도 최신화');
  start.props.onClick(); start.props.onClick();
  button(tree, '지도 다시 불러오기').props.onClick();
  assert.equal(calls.length, 2, 'one preflight; stale reload and duplicate clicks must not fetch');
  assert.equal(button(map.render(), '지도 다시 불러오기').props.disabled, true);
  button(refresh.render(), '대기 중지').props.onClick();
  assert.equal(pending[0].signal.aborted, true);
  assert.equal(button(map.render(), '지도 다시 불러오기').props.disabled, false);
  pending[0].resolve(Response.json({ ok: true, update_available: true })); await flush();
  assert.ok(calls.every(c => c[1] === 'GET'));
  assert.match(text(refresh.render()), /대기를 중지했습니다/);
  button(map.render(), '지도 다시 불러오기').props.onClick(); await flush();
  assert.equal(calls.at(-1)[0], '/api/map/?kid=1622&fresh=1');
});

test('reload already in flight refuses a stale latest-location click', async t => {
  const restoreWindow = browserTimers(), pending = [];
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => ++calls === 1 ? Response.json(snapshot()) : new Promise(resolve => pending.push(resolve)));
  const map = mount(StoredMapScope, { kid: 1622, selectedUID: '2', onLookup() {} });
  await flush(); const tree = settle(map);
  const refresh = mount(MapRefreshScope, refreshProps(tree));
  t.after(() => { refresh.unmount(); map.unmount(); restoreWindow(); });
  button(tree, '지도 다시 불러오기').props.onClick();
  button(refresh.render(), '최신 위치 찾기').props.onClick();
  assert.equal(calls, 2);
  assert.equal(button(refresh.render(), '대기 중지'), undefined);
  pending[0](Response.json(snapshot())); await flush();
});

test('kid/profile scopes abort old refresh and reset outcome/cooldown without accepting late callbacks', async t => {
  const restoreWindow = browserTimers(), pending = [], received = [], busy = [];
  t.mock.method(globalThis, 'fetch', (_, options) => new Promise(resolve => pending.push({ resolve, signal: options.signal })));
  const props = { kid: 1622, selectedUID: '2', baseline: 100, onSnapshot: value => received.push(value), onBusyChange: value => { busy.push(value); } };
  const old = mount(MapRefreshScope, props);
  button(old.render(), '최신 위치 찾기').props.onClick(); old.unmount();
  assert.equal(pending[0].signal.aborted, true);
  const nextProps = { ...props, selectedUID: '3' };
  const current = mount(MapRefreshScope, nextProps);
  t.after(() => { current.unmount(); restoreWindow(); });
  assert.notEqual(MapRefresh(props).key, MapRefresh(nextProps).key);
  assert.notEqual(MapRefresh(props).key, MapRefresh({ ...props, kid: 1623 }).key);
  assert.equal(button(current.render(), '최신 위치 찾기').props.disabled, false);
  assert.doesNotMatch(text(current.render()), /완료|다음 요청까지/);
  pending[0].resolve(Response.json({ ok: true, update_available: true })); await flush();
  assert.deepEqual(received, []); assert.deepEqual(busy, [true, false]);
});
