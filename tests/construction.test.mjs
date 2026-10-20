import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
import { mergeConstructionSupplement } from '../scripts/construction-supplement.mjs';

async function load(path) {
  const source = ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}
const { planConstruction, planBuildingSteps, adjustedTime, levelLabel } = await load('../src/lib/construction.ts');
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
test('pet is additive speed, with decree applied afterwards and none backwards compatible', () => {
  for (const pet of [0, 5, 7, 9, 12, 15]) {
    const expected = 1296000 / (1 + (12.5 + pet) / 100);
    assert.equal(adjustedTime(1296000, 12.5, false, pet), expected);
    assert.equal(adjustedTime(1296000, 12.5, true, pet), expected * 0.8);
  }
  assert.notEqual(adjustedTime(100, 0, false, 15), 85);
  assert.equal(adjustedTime(1125, 12.5, true, 0), adjustedTime(1125, 12.5, true));
  for (const pet of [NaN, Infinity, -1, 16]) assert.throws(() => adjustedTime(100, 0, false, pet));
});
test('real TG5 to TG6 partial boundaries preserve individual costs and resource totals with pet', async () => {
  const { CONSTRUCTION_BUILDINGS: data } = await load('../src/data/construction-costs.ts');
  const currents = Object.fromEntries(data.map(b => [b.id, 55]));
  const town = data.find(b => b.id === 'town-center');
  const full = planBuildingSteps(town, 55, 60);
  assert.equal(full.totals.truegold, 900);
  assert.equal(full.totals.temperedTruegold, 60);
  assert.equal(full.totals.seconds, 75 * 86400);
  assert.deepEqual(full.rows.map(row => [row.level, row.truegold, row.temperedTruegold, row.seconds]), [
    [56, 200, 10, 1296000], [57, 200, 10, 1296000], [58, 200, 10, 1296000],
    [59, 200, 10, 1296000], [60, 100, 20, 1296000],
  ]);
  for (const [current, target, levels, tg, ttg] of [
    [55, 56, [56], 200, 10], [57, 59, [58, 59], 400, 20],
    [59, 60, [60], 100, 20], [60, 60, [], 0, 0],
  ]) {
    const plan = planBuildingSteps(town, current, target);
    assert.deepEqual(plan.rows.map(row => row.level), levels);
    assert.equal(plan.totals.truegold, tg);
    assert.equal(plan.totals.temperedTruegold, ttg);
    assert.equal(plan.totals.seconds, levels.length * 15 * 86400);
  }
  const before = structuredClone(full);
  const sum = full.rows.reduce((total, row) => total + adjustedTime(row.seconds, 12.5, true, 15), 0);
  assert.ok(Math.abs(sum - adjustedTime(full.totals.seconds, 12.5, true, 15)) < 1e-8);
  assert.deepEqual(full, before);
  const withPrerequisites = planConstruction(data, { ...currents, embassy: 50 }, { 'town-center': 56 });
  assert.equal(withPrerequisites.rows.filter(row => row.buildingId === 'town-center').length, 1);
  assert.ok(withPrerequisites.totals.truegold > 200);
});
test('single-building path validates boundaries and atomic transitions without following prerequisites', () => {
  const data = building('town-center', [step(30), step(35, { missing: 99 }, { fromLevel: 30 }), step(36)]);
  assert.deepEqual(planBuildingSteps(data, 30, 36).rows.map(row => row.level), [35, 36]);
  assert.equal(planBuildingSteps(data, 30, 35).totals.truegold, 2);
  assert.equal(planBuildingSteps(data, 35, 35).totals.seconds, 0);
  for (const [current, target] of [[28, 35], [30, 37], [35, 30], [30.5, 35], [NaN, 35], [30, Infinity], [32, 35]]) {
    assert.throws(() => planBuildingSteps(data, current, target));
  }
  assert.throws(() => planBuildingSteps(building('tc', [step(2), step(4)]), 1, 4), /데이터/);
  assert.throws(() => planBuildingSteps(building('tc', [step(2, {}, { seconds: NaN })]), 1, 2), /seconds/);
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
test('verified Town Center TG9/TG10 partial boundaries and full tier totals', async () => {
  const { CONSTRUCTION_BUILDINGS: data } = await load('../src/data/construction-costs.ts');
  const town = data.find(b => b.id === 'town-center');
  for (const [current, target, tg, tempered, days] of [
    [70, 71, 280, 30, 13], [74, 75, 140, 60, 13],
    [75, 76, 350, 70, 20], [79, 80, 175, 140, 20],
    [70, 75, 1260, 180, 65], [75, 80, 1575, 420, 100],
    [70, 80, 2835, 600, 165], [80, 80, 0, 0, 0],
  ]) {
    const plan = planBuildingSteps(town, current, target);
    assert.equal(plan.rows.length, target - current);
    assert.equal(plan.totals.truegold, tg);
    assert.equal(plan.totals.temperedTruegold, tempered);
    assert.equal(plan.totals.seconds, days * 86400);
  }
  assert.deepEqual(planBuildingSteps(town, 70, 80).totals, {
    bread: 1500000000, wood: 1500000000, stone: 310000000, iron: 78000000,
    truegold: 2835, temperedTruegold: 600, seconds: 14256000,
  });
  assert.equal(levelLabel(71), '순금 9 · 1/5');
  assert.equal(levelLabel(75), '순금 9');
  assert.equal(levelLabel(76), '순금 10 · 1/5');
  assert.equal(levelLabel(80), '순금 10');
  assert.throws(() => planBuildingSteps(town, 80, 81), /데이터/);
  assert.ok(data.filter(b => b.id !== 'town-center').every(b => b.steps.every(s => s.level <= 70)));
  const currents = Object.fromEntries(data.map(b => [b.id, 70]));
  assert.throws(() => planConstruction(data, currents, { 'town-center': 80 }), /데이터/);
});
test('supplement merge survives repeated sync, preserves base data and rejects conflicts', async () => {
  const { CONSTRUCTION_BUILDINGS: data } = await load('../src/data/construction-costs.ts');
  const supplement = JSON.parse(await readFile(new URL('../src/data/construction-supplement.json', import.meta.url), 'utf8'));
  const base = data.map(b => ({ ...b, steps: b.steps.filter(s => s.level <= 70) }));
  const before = structuredClone(base);
  const merged = mergeConstructionSupplement(base, supplement);
  assert.deepEqual(merged, data);
  assert.deepEqual(mergeConstructionSupplement(merged, supplement), data);
  assert.deepEqual(base, before);
  assert.deepEqual(merged.filter(b => b.id !== 'town-center'), base.filter(b => b.id !== 'town-center'));
  const conflict = structuredClone(merged);
  conflict.find(b => b.id === 'town-center').steps.find(s => s.level === 71).truegold = 999;
  assert.throws(() => mergeConstructionSupplement(conflict, supplement), /conflicts/);
  const gap = structuredClone(supplement);
  gap.buildings[0].steps.shift();
  assert.throws(() => mergeConstructionSupplement(base, gap), /gap/);
});
