import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const moduleURL = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
// Render actual player components with real React. Only locale and image imports
// are substituted; SSR never runs their network effects.
const localeURL = moduleURL('export const getLocale = () => "zh-TW"; export const useLocale = () => ({ locale: "zh-TW", t: (_ko,en,zhTW) => zhTW ?? en });');
const modules = new Map([[resolve(root, 'src/lib/locale.ts'), localeURL]]);
async function moduleFor(path) {
  if (modules.has(path)) return modules.get(path);
  const source = ts.transpileModule(await readFile(path, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  let transformed = source;
  for (const match of source.matchAll(/from (["'])(.*?)\1/g)) {
    const spec = match[2]; let target;
    if (!spec.startsWith('.')) target = import.meta.resolve(spec);
    else if (/\.(webp|png|svg)$/.test(spec)) target = moduleURL('export default {src:"/test-image.webp"};');
    else {
      const base = resolve(dirname(path), spec.replace(/\.js$/, ''));
      let dependency;
      for (const candidate of [base, `${base}.ts`, `${base}.tsx`]) {
        try { await access(candidate); dependency = candidate; break; } catch { /* Try the next extension. */ }
      }
      assert.ok(dependency, `Unresolved ${spec} in ${path}`);
      target = await moduleFor(dependency);
    }
    transformed = transformed.replace(match[0], `from ${JSON.stringify(target)}`);
  }
  const result = moduleURL(transformed); modules.set(path, result); return result;
}
const load = async path => import(await moduleFor(resolve(root, path)));
const localization = await load('src/lib/player-localization.ts');
const { playerText, playerLabel, playerStatLabel, playerStatValue, playerError, playerNumberLocale } = localization;
const { rateLimitMessage } = await load('src/lib/api-response.ts');

test('Traditional Chinese uses agreed game terminology and translates units, stats, quality and roles', () => {
  for (const [ko, zh] of [['순금', '精金 (TG)'], ['도시 센터', '城鎮中心'], ['영주', '領主'], ['연맹', '聯盟'],
    ['왕국', '王國'], ['연구 전투력', '研究戰力'], ['신비의 시련', '神秘試煉']]) assert.equal(playerText(ko, 'zh-TW'), zh);
  assert.equal(playerLabel('Legendary', 'zh-TW'), '傳說');
  assert.equal(playerLabel('연맹장', 'zh-TW'), '盟主');
  assert.equal(playerLabel('Leader', 'zh-TW'), '盟主');
  assert.equal(playerLabel('알카', 'zh-TW'), 'Alcar');
  assert.equal(playerStatLabel('전체 부대 공격력', 1, 'zh-TW'), '全體部隊 攻擊力');
  assert.equal(playerStatLabel('Infantry Attack', 1, 'zh-TW'), '步兵 攻擊力');
  assert.equal(playerStatLabel('알 수 없는 속성', 42, 'zh-TW'), '屬性 42');
  assert.equal(playerStatValue('1.5억', 'zh-TW'), '150,000,000');
  assert.equal(playerStatValue('30초', 'zh-TW'), '30 秒');
  assert.equal(playerStatValue('순금 4', 'zh-TW'), '精金 (TG) 4');
  assert.equal(playerNumberLocale('zh-TW'), 'zh-TW');
  assert.equal(playerText(' 전투력 ', 'zh-TW'), ' 戰力 ');
  assert.equal(playerText('전투력', 'ko'), '전투력');
  assert.equal(playerText('전투력', 'en'), 'Power');
});

test('known, unknown and throttled API errors use Traditional Chinese without leaking untranslated diagnostics', () => {
  assert.equal(playerError('조회 시간이 초과되었습니다. 다시 시도해 주세요.', 'zh-TW'), '查詢逾時，請重試。');
  assert.equal(playerError('unexpected upstream error', 'zh-TW'), '無法載入資料，請稍後重試。');
  assert.equal(playerError('정의되지 않은 오류', 'zh-TW'), '無法載入資料，請稍後重試。');
  assert.equal(rateLimitMessage('rate_limited:15', 'zh-TW'), '請求暫時受到限制。請於 15 秒後重試。');
  assert.equal(rateLimitMessage('rate_limited', 'zh-TW'), '請求暫時受到限制。請稍後重試。');
});

test('all player/map entry panels render authored Traditional Chinese with no automatic SSR requests', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('unexpected fetch'); });
  for (const [name, props, expected] of [
    ['PlayerLookup', { heroes: {} }, /搜尋暱稱.*神秘試煉.*王國比較/],
    ['PlayerDiscovery', {}, /暱稱或關鍵字/],
    ['KingdomMap', {}, /查詢王國地圖/],
    ['KingdomRankings', {}, /神秘試煉/],
    ['KingdomComparison', {}, /研究戰力.*領主寶石/],
    ['MapRefresh', { kid: 1622 }, /更新地圖/],
    ['PlayerLocationMap', { kid: null, x: null, y: null, uid: null }, /缺少有效的王國編號/],
    ['OfficialAllianceMap', { kid: 1622 }, /聯盟成員位置地圖/],
    ['StoredKingdomMap', { kid: 1622 }, /王國 1622.*城鎮地圖/],
  ]) {
    const { default: Component } = await load(`src/components/islands/${name}.tsx`);
    const html = renderToStaticMarkup(createElement(Component, { onSelect() {}, onLookup() {}, onSnapshot() {}, ...props }));
    assert.match(html, expected, name);
    assert.doesNotMatch(html, /[가-힣]/, `${name} leaked Korean UI copy`);
    assert.doesNotMatch(html, /真金|純金|市政廳/, `${name} uses inconsistent terminology`);
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test('hero gear uses authored labels and established English proper names; map identities remain raw', async () => {
  const { default: Heroes } = await load('src/components/islands/ArenaHeroes.tsx');
  const heroHTML = renderToStaticMarkup(createElement(Heroes, { heroes: [{ id: 1, name: '알카', level: 10, star: 6, exclusive_gear: { slg_attr: [{ label: '보병 공격력', value: '1.5억' }] } }],
    catalog: { 1: { name: '알카', nameEn: 'Alcar', gearName: '운명의 방패', gearNameEn: 'Aegis of Fate' } } }));
  assert.match(heroHTML, /競技場防守英雄/); assert.match(heroHTML, /Alcar/); assert.match(heroHTML, /Aegis of Fate/);
  assert.match(heroHTML, /步兵 攻擊力/); assert.doesNotMatch(heroHTML, /[가-힣]/);
  const { default: Canvas, cityLevel } = await load('src/components/islands/KingdomMapCanvas.tsx');
  const city = { uid: '1', nick_name: '원본領主', alliance_abbr: '원盟', x: 100, y: 200, tc: 35, power: 123456 };
  const html = renderToStaticMarkup(createElement(Canvas, { cities: [city], allCities: [city], alliances: [], bounds: { min: 0, max: 1200 }, selected: city, onSelect() {}, onClose() {}, onLookup() {} }));
  assert.equal(cityLevel(city), '精金 (TG) 1');
  assert.match(html, /원본領主/); assert.match(html, /원盟/); assert.match(html, /查看裝備/);
  assert.doesNotMatch(html.replaceAll('원본領主', '').replaceAll('원盟', ''), /[가-힣]/);
});
