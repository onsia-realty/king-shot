import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = ts.transpileModule(await readFile(new URL('../src/components/islands/mapHitGeometry.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const { pickCity, groundRadii } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
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
test('decorative tile edges and empty corners do not capture clicks', () => {
  assert.equal(pickCity({ x: 119, y: 109 }, [back], []), undefined);
  assert.equal(pickCity({ x: 122, y: 100 }, [back], []), undefined);
  assert.equal(pickCity({ x: 130, y: 100 }, [back], []), undefined);
});
test('small scale circles do not snap across the gap between cities', () => {
  const a = { city: 'a', point: { x: 10, y: 10 }, tile: 2 };
  const b = { city: 'b', point: { x: 16, y: 10 }, tile: 2 };
  assert.equal(pickCity({ x: 12, y: 10 }, [a, b], []), 'a');
  assert.equal(pickCity({ x: 13, y: 10 }, [a, b], []), undefined);
  assert.equal(pickCity({ x: 30, y: 30 }, [a, b], []), undefined);
});

test('ground ellipse includes its axes but excludes rectangle corners', () => {
  const city = { city: 'circle', point: { x: 0, y: 0 }, tile: 20 };
  const radius = groundRadii(city.tile);
  for (const sign of [-1, 1]) {
    assert.equal(pickCity({ x: sign * radius.x, y: 0 }, [city], []), 'circle');
    assert.equal(pickCity({ x: 0, y: sign * radius.y }, [city], []), 'circle');
    assert.equal(pickCity({ x: sign * (radius.x + 0.01), y: 0 }, [city], []), undefined);
  }
  assert.equal(pickCity({ x: radius.x * 0.8, y: radius.y * 0.8 }, [city], []), undefined);
});

test('compact ground does not steal a neighboring body under a large tile', () => {
  const wide = { city: 'wide', point: { x: 0, y: 0 }, tile: 40 };
  const neighbor = { city: 'neighbor', point: { x: 35, y: 15 }, tile: 10, body: { x: 28, y: -15, width: 14, height: 30 } };
  assert.equal(pickCity({ x: 33, y: 0 }, [wide, neighbor], []), 'neighbor');
});

test('overlapping ground ellipses use distance then paint order on ties', () => {
  const a = { city: 'a', point: { x: 0, y: 0 }, tile: 20 };
  const b = { city: 'b', point: { x: 10, y: 0 }, tile: 20 };
  assert.equal(pickCity({ x: 4, y: 0 }, [a, b], []), 'a');
  assert.equal(pickCity({ x: 5, y: 0 }, [a, b], []), 'b');
});
