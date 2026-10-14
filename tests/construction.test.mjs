import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

async function load(path) {
  const source = ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}
const { planConstruction, adjustedTime, levelLabel } = await load('../src/lib/construction.ts');
const step = (level, requirements = {}, extra = {}) => ({ level, bread: 10, wood: 20, stone: 30, iron: 40, truegold: 2, temperedTruegold: 1, seconds: 100, requirements, ...extra });
const building = (id, steps) => ({ id, name: id, steps });

test('recursive shared prerequisites close at maximum and honor every current', () => {
  const data = [building('tc', [step(2, { a: 2, b: 2 })]), building('a', [step(2, { shared: 2 })]), building('b', [step(2, { shared: 3 })]), building('shared', [step(2), step(3)])];
  const plan = planConstruction(data, { tc: 1, a: 1, b: 1, shared: 2 }, { tc: 2 });
  assert.equal(plan.rows.length, 4);
  assert.equal(plan.totals.bread, 40);
  assert.equal(plan.targets.shared, 3);
  assert.equal(plan.rows[0].buildingId, 'a');
  assert.equal(plan.rows.at(-1).buildingId, 'tc');
  assert.equal(planConstruction(data, { tc: 1, a: 2, b: 2, shared: 3 }, { tc: 2 }).rows.length, 1);
});
test('TG partial steps include only current < step <= target', () => {
  const data = [building('tc', [31, 32, 33, 34, 35].map(level => step(level)))];
  const plan = planConstruction(data, { tc: 32 }, { tc: 34 });
  assert.deepEqual(plan.rows.map(row => row.level), [33, 34]);
  assert.equal(plan.totals.truegold, 4);
  assert.equal(plan.totals.temperedTruegold, 2);
  assert.equal(levelLabel(35), '순금 1');
  assert.equal(levelLabel(31), '순금 1 · 1/5');
});
test('explicit atomic transitions skip no real costs and reject invalid starting state', () => {
  const data = [building('academy', [step(30), step(35, {}, { fromLevel: 30 }), step(36)])];
  assert.deepEqual(planConstruction(data, { academy: 30 }, { academy: 36 }).rows.map(row => row.level), [35, 36]);
  assert.throws(() => planConstruction(data, { academy: 32 }, { academy: 35 }), /단계 데이터/);
});
test('decimal bonus and double time preserve precision', () => {
  assert.equal(adjustedTime(1125, 12.5), 1000);
  assert.equal(adjustedTime(1125, 12.5, true), 800);
  assert.equal(adjustedTime(100, 0, true), 80);
  for (const value of [NaN, Infinity, -1]) assert.throws(() => adjustedTime(1, value));
});
test('missing steps, resources, prerequisites and cyclic dependencies fail explicitly', () => {
  assert.throws(() => planConstruction([building('a', [step(2), step(4)])], { a: 1 }, { a: 4 }), /데이터/);
  assert.throws(() => planConstruction([building('a', [step(2, {}, { bread: undefined })])], { a: 1 }, { a: 2 }), /bread/);
  assert.throws(() => planConstruction([building('a', [step(2, { missing: 2 })])], { a: 1 }, { a: 2 }), /선행 건물 데이터/);
  assert.throws(() => planConstruction([building('a', [step(2, { b: 2 })]), building('b', [step(2, { a: 2 })])], { a: 1, b: 1 }, { a: 2 }), /순환/);
});
test('real default TG1 matches reference and TG8 closes without missing data', async () => {
  const { CONSTRUCTION_BUILDINGS: data } = await load('../src/data/construction-costs.ts');
  const currents = Object.fromEntries(data.map(b => [b.id, b.id === 'town-center' ? 30 : 25]));
  const plan = planConstruction(data, currents, { 'town-center': 35 });
  assert.deepEqual(plan.totals, { bread: 931000000, wood: 931000000, stone: 182200000, iron: 46000000, truegold: 660, temperedTruegold: 0, seconds: 13466400 });
  assert.equal(Math.floor(plan.totals.seconds / 3600), 155 * 24 + 20);
  assert.equal(Math.floor(adjustedTime(plan.totals.seconds, 12.5, true) / 3600), 110 * 24 + 20);
  const tg8 = planConstruction(data, currents, { 'town-center': 70 });
  assert.equal(tg8.totals.truegold, 19681);
  assert.equal(tg8.totals.temperedTruegold, 389);
  const academy = planConstruction(data, currents, { academy: 40, 'town-center': 40 });
  assert.equal(academy.rows.filter(row => row.buildingId === 'academy' && row.level === 35).length, 1);
});
