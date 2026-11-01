import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { parse, transform } from '@astrojs/compiler';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const localeSource = await read('src/lib/locale.ts');
const switchSource = await read('src/components/LanguageSwitch.astro');
const compile = source => ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;
function events(target = {}) {
  const listeners = new Map();
  return Object.assign(target, {
    addEventListener(name, fn) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn); },
    removeEventListener(name, fn) { listeners.get(name)?.delete(fn); },
    dispatchEvent(event) { for (const fn of listeners.get(event.type) ?? []) fn(event); },
  });
}
class Element {
  constructor(attributes = {}) { this.attributes = { ...attributes }; this.textContent = 'untouched'; }
  getAttribute(name) { return this.attributes[name] ?? null; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  get dataset() { return { setLocale: this.getAttribute('data-set-locale') }; }
  closest() { return this.getAttribute('data-set-locale') ? this : null; }
}
function environment({ saved, blocked = false, pathname = '/', search = '', ssr = false, nodes = [] } = {}) {
  const storage = new Map(saved === undefined ? [] : [['ks-language', saved]]);
  const window = events({ location: { pathname, search }, localStorage: {
    getItem(key) { if (blocked) throw Error('blocked'); return storage.get(key) ?? null; },
    setItem(key, value) { if (blocked) throw Error('blocked'); storage.set(key, value); },
  } });
  const document = events({ documentElement: { lang: 'ko' }, querySelectorAll(selector) {
    const attrs = [...selector.matchAll(/\[([^\]]+)\]/g)].map(m => m[1]);
    return nodes.filter(node => attrs.every(attr => node.getAttribute(attr) !== null));
  } });
  const context = vm.createContext({ exports: {}, document, Element, URLSearchParams,
    require(name) {
      assert.equal(name, 'react');
      return { useSyncExternalStore: (_subscribe, snapshot, serverSnapshot) => ssr ? serverSnapshot() : snapshot() };
    },
    CustomEvent: class { constructor(type, { detail }) { this.type = type; this.detail = detail; } },
    ...(!ssr ? { window, location: window.location } : {}),
  });
  vm.runInContext(compile(localeSource), context);
  const api = context.exports;
  return { context, window, document, storage, api, mountSwitch() {
    Object.assign(context, api);
    const script = switchSource.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/^\s*import .*;$/gm, '');
    vm.runInContext(compile(script), context);
  } };
}

test('SSR remains Korean; zh-TW persists across loads with explicit English fallback', () => {
  const server = environment({ ssr: true });
  assert.equal(server.api.getLocale(), 'ko');
  assert.equal(server.api.useLocale().t('한국어', 'English', '繁體中文'), '한국어');
  server.api.setLocale('zh-TW');
  const browser = environment();
  let detail;
  browser.window.addEventListener(browser.api.LOCALE_EVENT, event => { detail = event.detail; });
  browser.api.setLocale('zh-TW');
  assert.equal(detail, 'zh-TW'); assert.equal(browser.storage.get('ks-language'), 'zh-TW');
  const reloaded = environment({ saved: browser.storage.get('ks-language') });
  assert.equal(reloaded.api.useLocale().locale, 'zh-TW');
  assert.equal(reloaded.api.useLocale().t('한국어', 'English', '繁體中文'), '繁體中文');
  assert.equal(reloaded.api.useLocale().t('한국어', 'English'), 'English');
  assert.equal(reloaded.api.useLocale().t('한국어', 'English', ''), '');
  for (const [locale, expected] of [['ko', '한국어'], ['en', 'English']]) {
    browser.api.setLocale(locale);
    assert.equal(browser.api.useLocale().t('한국어', 'English', '繁體中文'), expected);
  }
});

test('shared language links override saved preference once, persist and still allow manual switching', () => {
  for (const blocked of [false, true]) {
    const app = environment({ saved: 'ko', pathname: '/player/', search: '?tab=comparison&lang=zh-TW&id=241185659', blocked });
    assert.equal(app.api.getLocale(), 'zh-TW');
    if (!blocked) assert.equal(app.storage.get('ks-language'), 'zh-TW');
    app.api.setLocale('en'); assert.equal(app.api.getLocale(), 'en');
  }
  assert.equal(environment({ saved: 'en', search: '?lang=invalid' }).api.getLocale(), 'en');
  assert.equal(environment({ saved: 'ko', pathname: '/heroes/', search: '?lang=zh-TW' }).api.getLocale(), 'ko');
});

test('blocked storage still supports session choice; invalid saved/requested values are ignored', () => {
  for (const saved of ['zh-CN', 'zh-tw', '__proto__', '']) assert.equal(environment({ saved }).api.getLocale(), 'ko');
  const { api, window } = environment({ blocked: true });
  assert.equal(api.getLocale(), 'ko');
  let changes = 0;
  window.addEventListener(api.LOCALE_EVENT, () => changes++);
  api.setLocale('zh-TW'); assert.equal(api.getLocale(), 'zh-TW');
  api.setLocale('zh-CN'); assert.equal(api.getLocale(), 'zh-TW'); assert.equal(changes, 1);
});

test('cross-tab changes and clearing storage notify subscribers; unrelated keys and cleanup do not', () => {
  const { api, window } = environment({ saved: 'en' });
  let changes = 0;
  const unsubscribe = api.subscribe(() => changes++);
  window.dispatchEvent({ type: 'storage', key: 'calculator-input', newValue: 'ko' });
  assert.equal(changes, 0); assert.equal(api.getLocale(), 'en');
  window.dispatchEvent({ type: 'storage', key: api.LOCALE_STORAGE_KEY, newValue: 'zh-TW' });
  assert.equal(changes, 1); assert.equal(api.getLocale(), 'zh-TW');
  window.dispatchEvent({ type: 'storage', key: null, newValue: null });
  assert.equal(changes, 2); assert.equal(api.getLocale(), 'ko');
  unsubscribe(); api.setLocale('en');
  window.dispatchEvent({ type: 'storage', key: api.LOCALE_STORAGE_KEY, newValue: 'zh-TW' });
  assert.equal(changes, 2); assert.equal(api.getLocale(), 'en');
});

test('switch updates document language, metadata and accessible attributes without touching island text', () => {
  const title = new Element({ 'data-locale-ko': '제목', 'data-locale-en': 'Title', 'data-locale-zh-tw': '標題' });
  const fallback = new Element({ 'data-locale-ko': '안내', 'data-locale-en': 'Notice' });
  const island = new Element();
  const attributes = ['content', 'aria-label', 'title', 'alt'].map(name => new Element({
    [`data-${name}-ko`]: '한국어', [`data-${name}-en`]: 'English', [`data-${name}-zh-tw`]: '繁體中文',
  }));
  const buttons = ['ko', 'en', 'zh-TW'].map(locale => new Element({ 'data-set-locale': locale }));
  const app = environment({ saved: 'zh-TW', nodes: [title, fallback, island, ...attributes, ...buttons] });
  app.mountSwitch();
  assert.equal(app.document.documentElement.lang, 'zh-TW');
  assert.equal(title.textContent, '標題'); assert.equal(fallback.textContent, 'Notice');
  assert.equal(island.textContent, 'untouched');
  ['content', 'aria-label', 'title', 'alt'].forEach((name, i) => assert.equal(attributes[i].getAttribute(name), '繁體中文'));
  assert.equal(buttons[2].getAttribute('aria-pressed'), 'true');
  app.document.dispatchEvent({ type: 'click', target: buttons[1] });
  assert.equal(title.textContent, 'Title'); assert.equal(app.document.documentElement.lang, 'en');
  app.window.dispatchEvent({ type: 'storage', key: 'ks-language', newValue: 'zh-TW' });
  assert.equal(title.textContent, '標題'); assert.equal(app.document.documentElement.lang, 'zh-TW');
  app.document.dispatchEvent({ type: 'click', target: buttons[0] });
  assert.equal(title.textContent, '제목'); assert.equal(buttons[2].getAttribute('aria-pressed'), 'false');
});

test('Korean-only routes preserve saved language; page-load restores the preference on supported routes', () => {
  const label = new Element({ 'data-locale-ko': '한국어', 'data-locale-en': 'English', 'data-locale-zh-tw': '繁體中文' });
  const button = new Element({ 'data-set-locale': 'en' });
  const app = environment({ saved: 'zh-TW', pathname: '/guides/', nodes: [label, button] });
  app.mountSwitch();
  assert.equal(app.document.documentElement.lang, 'ko'); assert.equal(label.textContent, 'untouched');
  app.document.dispatchEvent({ type: 'click', target: button });
  assert.equal(app.api.getLocale(), 'zh-TW');
  for (const path of ['/', '/player/', '/tools/', '/tools/building-calculator/']) {
    app.window.location.pathname = path; app.document.dispatchEvent({ type: 'astro:page-load' });
    assert.equal(app.document.documentElement.lang, 'zh-TW'); assert.equal(label.textContent, '繁體中文');
  }
  for (const path of ['/toolshed/', '/players/', '/heroes/']) assert.equal(app.api.isLocaleScope(path), false);
});

test('all existing static English labels have authored Traditional Chinese with consistent terminology', async () => {
  const source = await read('src/lib/static-translations.ts');
  const context = vm.createContext({ exports: {} }); vm.runInContext(compile(source), context);
  const labels = JSON.parse(source.match(/const labels[^=]*= (\{[\s\S]*?\});/)[1]);
  for (const [ko, en] of Object.entries(labels)) {
    const zh = context.exports.staticTraditionalChinese(ko);
    assert.notEqual(zh, ko, ko); assert.notEqual(zh, en, ko);
    assert.doesNotMatch(zh, /[가-힣]|真金|純金|市政廳/);
  }
  assert.equal(context.exports.staticTraditionalChinese('순금·건설 비용 계산기'), '精金與建設計算器');
  assert.equal(context.exports.staticEnglish('홈'), 'Home');
  assert.equal(context.exports.staticTraditionalChinese('unmapped label'), 'unmapped label');
});

test('Astro translation targets, page metadata and FAQ entries all carry a third translation', async () => {
  const paths = (await readdir(new URL('../src/', import.meta.url), { recursive: true })).filter(path => path.endsWith('.astro'));
  let targets = 0;
  function inspect(node, file) {
    const attrs = new Map((node.attributes ?? []).map(attr => [attr.name, attr]));
    const expect = (source, target) => {
      if (attrs.has(source)) { assert.ok(attrs.has(target), `${file}: ${source} needs ${target}`); targets++; }
    };
    if (node.name === 'LocaleText') expect('en', 'zhTW');
    if (node.name === 'BaseLayout') {
      expect('titleEn', 'titleZhTW'); expect('fullTitleEn', 'fullTitleZhTW'); expect('descriptionEn', 'descriptionZhTW');
    }
    for (const field of ['locale', 'content', 'aria-label', 'title', 'alt']) expect(`data-${field}-en`, `data-${field}-zh-tw`);
    for (const child of node.children ?? []) inspect(child, file);
  }
  for (const path of paths) {
    const file = `src/${path.replaceAll('\\', '/')}`;
    const source = await read(file);
    if (!/LocaleText|data-locale-|descriptionEn=/.test(source)) continue;
    const { ast } = await parse(source); inspect(ast, file);
    const result = await transform(source, { filename: file });
    assert.deepEqual(result.diagnostics.filter(d => d.severity === 1), [], file);
    for (const field of ['q', 'a']) assert.equal(
      [...source.matchAll(new RegExp(`\\b${field}En:`, 'g'))].length,
      [...source.matchAll(new RegExp(`\\b${field}ZhTW:`, 'g'))].length, `${file}: FAQ ${field}`);
  }
  assert.ok(targets > 200);
});

test('visit counter renders zh-TW numbers and unknown counts without additional requests', async () => {
  const today = {}, total = {};
  let calls = 0;
  const context = vm.createContext({ exports: {}, AbortSignal, document: {
    documentElement: { lang: 'zh-TW' }, querySelectorAll: selector => selector.includes('today') ? [today] : [total],
  }, fetch: async () => { calls++; return { ok: true, json: async () => ({ ok: true, today: 1234, total: 567890, date: '2026-11-01' }) }; } });
  vm.runInContext(compile(await read('src/lib/visits.ts')), context);
  await context.exports.updateVisitCounter();
  assert.equal(today.textContent, (1234).toLocaleString('zh-TW'));
  assert.equal(total.textContent, (567890).toLocaleString('zh-TW')); assert.equal(calls, 1);
  context.fetch = async () => ({ ok: false });
  await context.exports.updateVisitCounter(); assert.equal(today.textContent, '—'); assert.equal(total.textContent, '—');
});
