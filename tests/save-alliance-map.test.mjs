import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/lib/server/save-alliance-map.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  .replace("import { query } from './kingdom-store.js';", 'const query = () => { throw new Error("Tests must inject storage"); };');
const { saveAlliancePositions, SAVE_POSITIONS_SQL } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const city = { uid: '60611017', kid: 1622, nick_name: 'A', x: 0, y: 1200, power: 1, tc: 55, aid: '163100207', alliance_abbr: 'ROK', profile_cached_at: 1793327540.25 };
const data = { kind: 'positions', kid: 1622, alliance: { aid: '163100207', abbr: 'ROK', name: 'HaeMil' }, cities: [city] };

test('interactive batches preserve actual city affiliations and submit one atomic storage query', async () => {
  const calls = [];
  const run = async (sql, params) => { calls.push({ sql, params }); return []; };
  assert.equal(await saveAlliancePositions(data, run), true);
  assert.equal(await saveAlliancePositions({ ...data, alliance: { aid: '163100024', abbr: 'FTM', name: 'Free' }, cities: [{ ...city, uid: '22', aid: '163100024', alliance_abbr: 'FTM' }] }, run), true);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].sql, SAVE_POSITIONS_SQL);
  assert.deepEqual(JSON.parse(calls[0].params[4]), [city]);
  assert.equal(JSON.parse(calls[1].params[4])[0].alliance_abbr, 'FTM');
  assert.match(SAVE_POSITIONS_SQL, /excluded\.profile_cached_at >= public\.players\.profile_cached_at/);
  assert.doesNotMatch(SAVE_POSITIONS_SQL, /DELETE|TRUNCATE/);
});

test('invalid positions and wrong-kingdom profiles never enter persistent storage', async () => {
  let called = false;
  const run = async () => { called = true; return []; };
  const bad = [{ ...city, x: NaN }, { ...city, x: -1 }, { ...city, y: 1201 }, { ...city, kid: 938 }, { ...city, uid: '0' }, { ...city, profile_cached_at: Infinity }];
  assert.equal(await saveAlliancePositions({ ...data, cities: bad }, run), false);
  assert.equal(called, false);
  assert.equal(await saveAlliancePositions({ ...data, kid: 0 }, run), false);
  assert.equal(called, false);
});

test('repeated UIDs cannot create a PostgreSQL double-update conflict', async () => {
  let submitted;
  assert.equal(await saveAlliancePositions({ ...data, cities: [city, city] }, async (_sql, params) => { submitted = JSON.parse(params[4]); return []; }), true);
  assert.equal(submitted.length, 1);
});

test('storage failure is reported without rejecting a successful official lookup', async () => {
  assert.equal(await saveAlliancePositions(data, async () => { throw new Error('private connection detail'); }), false);
});
