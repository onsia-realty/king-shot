import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = path => readFile(new URL(path, import.meta.url), 'utf8');
const dataUrl = js => `data:text/javascript;base64,${Buffer.from(js).toString('base64')}`;
const compile = text => ts.transpileModule(text, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
} }).outputText;
const dictionaryUrl = dataUrl(compile(await source('../src/lib/calculator-zh-tw.ts')));
const localeStub = dataUrl('export const getLocale=()=>"zh-TW"; export const useLocale=()=>({locale:"zh-TW"});');
const helperSource = await source('../src/lib/calculator-locale.ts');
const helper = await import(dataUrl(compile(helperSource)
  .replace(/from ['"]\.\/locale['"]/, `from '${localeStub}'`)
  .replace(/from ['"]\.\/calculator-zh-tw['"]/, `from '${dictionaryUrl}'`)));
const { calculatorText: tx, calculatorUi: ui, formatCalculatorNumber: number, formatCalculatorDate: date } = helper;
const islands = ['BuildingCalculator', 'BasicBuildingCalculator', 'HeroAscensionCalculator', 'HeroComparison',
  'EventScoreCalculator', 'PackValueCalculator', 'PackageRefTable', 'SpecUpCalculator', 'SpecUpRoadmap', 'ContentUnlockPredictor'];

test('all static English-supported calculator UI calls have authored Traditional Chinese copy', async () => {
  const missing = [];
  let count = 0;
  for (const island of islands) {
    const tree = ts.createSourceFile(island + '.tsx', await source(`../src/components/islands/${island}.tsx`), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node) {
      if (ts.isCallExpression(node) && node.expression.getText(tree) === 'ui'
        && ts.isStringLiteral(node.arguments[0]) && ts.isStringLiteral(node.arguments[1]) && node.arguments.length === 2) {
        const ko = node.arguments[0].text, en = node.arguments[1].text;
        const translated = ui(ko, en, 'zh-TW');
        count++;
        if (/[가-힣]/.test(translated) || translated === en && /[A-Za-z]{3}/.test(en)) missing.push(`${island}: ${ko}`);
        assert.equal(ui(ko, en, 'ko'), ko);
        assert.equal(ui(ko, en, 'en'), en);
      }
      ts.forEachChild(node, visit);
    }
    visit(tree);
  }
  assert.ok(count > 200);
  assert.deepEqual(missing, []);
});

test('dynamic costs, durations, tiers and forecast notices preserve quantities and translate units', () => {
  const cases = [
    ['순금 6 · 1/5', '精金 6 · 1/5'],
    ['350일 12시간 30분 5초', '350 天 12 小時 30 分鐘 5 秒'],
    ['총 264시간', '合計 264 小時'],
    ['신화 T5 ★3', '神話 T5 ★3'],
    ['₩12.5만', '₩125,000'],
    ['7,500원', '7,500 韓元'],
    ['5세대 영웅', '第 5 世代英雄'],
    ['순금 1,000개 / 건설 가속 2분', '精金 1,000 個 / 建造加速 2 分鐘'],
    ['K1622: 해금 12개, 예정 9개', 'K1622：已解鎖 12 項，預計解鎖 9 項'],
    ['아직 데이터가 없는 왕국입니다. K1~K2592까지 지원합니다.', '此王國尚無資料。目前支援 K1～K2592。'],
  ];
  for (const [ko, zh] of cases) assert.equal(tx(ko, 'zh-TW'), zh, ko);
  assert.equal(ui('조이', 'Zoe', 'zh-TW'), 'Zoe');
  assert.equal(tx('없는 신규 자료', 'zh-TW'), '［待翻譯］없는 신규 자료');
});

test('calculator source-data labels and forecast notes have Chinese display translations', async () => {
  const missing = [];
  for (const file of ['event-score', 'package-ref', 'spec-up', 'spec-up-roadmap', 'pack-value', 'content-unlock', 'construction-costs', 'building-costs']) {
    const tree = ts.createSourceFile(file, await source(`../src/data/${file}.ts`), ts.ScriptTarget.Latest, true);
    function visit(node) {
      if (ts.isStringLiteral(node) && /[가-힣]/.test(node.text)) {
        const translated = tx(node.text, 'zh-TW');
        if (/[가-힣]/.test(translated) || translated === tx(node.text, 'en')) missing.push(`${file}: ${node.text}`);
      }
      ts.forEachChild(node, visit);
    }
    visit(tree);
  }
  assert.deepEqual(missing, []);
});

test('numeric precision and date-only values are locale-aware without changing dates or currencies', () => {
  assert.equal(number(123456.789, { maximumFractionDigits: 2 }, 'zh-TW'), '123,456.79');
  const day = Date.UTC(2026, 10, 1) / 86400000;
  assert.equal(date(day, 'zh-TW'), '2026/11/01');
  assert.match(date(day, 'en'), /11\/01\/2026/);
  assert.equal(tx('1,000원', 'zh-TW'), '1,000 韓元');
});
