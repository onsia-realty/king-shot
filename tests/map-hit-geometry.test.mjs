import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = ts.transpileModule(await readFile(new URL('../src/components/islands/mapHitGeometry.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const { pickCity } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const back = { city: 'back', point: { x: 100, y: 100 }, tile: 20, body: { x: 85, y: 50, width: 30, height: 50 } };
const front = { city: 'front', point: { x: 116, y: 116 }, tile: 20, body: { x: 101, y: 66, width: 30, height: 50 } };

test('last painted label wins over other labels and city geometry', () => {
  const rect = { x: 90, y: 90, width: 40, height: 30 };
  assert.equal(pickCity({ x: 100, y: 100 }, [back, front], [{ ...rect, city: 'front' }, { ...rect, city: 'back' }]), 'back');
});
test('diagonal ground footprint is not stolen by a front sprite rectangle', () => {
  assert.equal(pickCity({ x: 108, y: 99 }, [back, front], []), 'back');
  assert.equal(pickCity({ x: 116, y: 116 }, [back, front], []), 'front');
});
test('overlapping bodies choose closest body instead of last bounding box', () => {
  assert.equal(pickCity({ x: 102, y: 75 }, [back, front], []), 'back');
  assert.equal(pickCity({ x: 116, y: 85 }, [back, front], []), 'front');
});
test('diamond corners stay empty beyond the small footprint tolerance', () => {
  assert.equal(pickCity({ x: 119, y: 109 }, [back], []), undefined);
  assert.equal(pickCity({ x: 122, y: 100 }, [back], []), 'back');
  assert.equal(pickCity({ x: 130, y: 100 }, [back], []), undefined);
});
test('small scale nearest fallback and equal-distance paint order', () => {
  const a = { city: 'a', point: { x: 10, y: 10 }, tile: 2 };
  const b = { city: 'b', point: { x: 16, y: 10 }, tile: 2 };
  assert.equal(pickCity({ x: 12.5, y: 10 }, [a, b], []), 'a');
  assert.equal(pickCity({ x: 13, y: 10 }, [a, b], []), 'b');
  assert.equal(pickCity({ x: 30, y: 30 }, [a, b], []), undefined);
});
