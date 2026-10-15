import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = ts.transpileModule(await readFile(new URL('../src/components/islands/mapHitGeometry.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const { pickCity, pickCities, groundRadii, citySpriteRect, citySpriteSize, compactCityLevel, placeCityLabel, overlaps, MAX_CITY_SCALE } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const back = { city: 'back', point: { x: 100, y: 100 }, tile: 20, body: { x: 85, y: 50, width: 30, height: 50 } };
const front = { city: 'front', point: { x: 116, y: 116 }, tile: 20, body: { x: 101, y: 66, width: 30, height: 50 } };

test('last painted label wins over other labels and city geometry', () => {
  const rect = { x: 90, y: 90, width: 40, height: 30 };
  assert.equal(pickCity({ x: 100, y: 100 }, [back, front], [{ ...rect, city: 'front' }, { ...rect, city: 'back' }]), 'back');
});
test('visible front body wins while the covered ground remains reachable', () => {
  assert.deepEqual(pickCities({ x: 108, y: 99 }, [back, front], []), ['front', 'back']);
  assert.equal(pickCity({ x: 116, y: 116 }, [back, front], []), 'front');
});
test('overlapping bodies follow paint order instead of selecting a hidden body by center', () => {
  assert.deepEqual(pickCities({ x: 102, y: 75 }, [back, front], []), ['front', 'back']);
  assert.equal(pickCity({ x: 116, y: 85 }, [back, front], []), 'front');
});

test('coincident cities are all reachable without duplicate label/ground candidates', () => {
  const cities = ['a', 'b', 'c'].map((city) => ({ ...back, city }));
  assert.deepEqual(pickCities({ x: 100, y: 90 }, cities, [{ x: 90, y: 80, width: 20, height: 20, city: 'b' }]), ['b', 'c', 'a']);
});

test('skin hit bounds exactly match its rendered rectangle including bottom offset', () => {
  const point = { x: 100, y: 200 };
  const body = citySpriteRect(point, 80, 120);
  assert.deepEqual(body, { x: 60, y: 84, width: 80, height: 120 });
  const city = { city: 'skin', point, tile: 30, body };
  for (const p of [{ x: 60, y: 84 }, { x: 140, y: 204 }, { x: 61, y: 100 }]) assert.equal(pickCity(p, [city], []), 'skin');
  assert.equal(pickCity({ x: 59, y: 100 }, [city], []), undefined);
  assert.equal(pickCity({ x: 100, y: 83 }, [city], []), undefined);
});

test('nearby labels avoid the actual painted rectangles and stay inside mobile viewport', () => {
  const viewport = { x: 0, y: 0, width: 375, height: 420 };
  const occupied = [{ x: 120, y: 206, width: 120, height: 28 }];
  const label = placeCityLabel({ x: 180, y: 200 }, 110, occupied, viewport);
  assert.ok(label);
  assert.equal(overlaps(label, occupied[0]), false);
  assert.ok(label.x >= 0 && label.x + label.width <= 375);
  assert.equal(label.height, 14);
  assert.equal(placeCityLabel({ x: 180, y: 200 }, 110, [viewport], viewport), undefined);
});

test('viewport intersection retains a city whose ground is below the screen', () => {
  const viewport = { x: 0, y: 0, width: 375, height: 420 };
  assert.equal(overlaps(citySpriteRect({ x: 180, y: 450 }, 100, 150), viewport), true);
  assert.equal(overlaps(citySpriteRect({ x: 180, y: -10 }, 100, 150), viewport), false);
});

test('close zoom separates adjacent city centers while ground highlights remain restrained', () => {
  assert.ok(MAX_CITY_SCALE >= 80);
  const radius = groundRadii(MAX_CITY_SCALE);
  assert.ok(radius.x < MAX_CITY_SCALE && radius.y < MAX_CITY_SCALE / 2);
  const a = { city: 'a', point: { x: 0, y: 0 }, tile: MAX_CITY_SCALE };
  const b = { city: 'b', point: { x: MAX_CITY_SCALE, y: MAX_CITY_SCALE }, tile: MAX_CITY_SCALE };
  assert.equal(pickCity(a.point, [a, b], []), 'a');
  assert.equal(pickCity(b.point, [a, b], []), 'b');
});

test('skins and ground scale proportionally at 30, 60, and 120 without the old cap', () => {
  const sizes = [30, 60, 120].map(citySpriteSize);
  assert.deepEqual(sizes, [75, 150, 300]);
  for (const scale of [60, 120]) {
    assert.equal(groundRadii(scale).x / groundRadii(30).x, scale / 30);
    assert.equal(groundRadii(scale).y / groundRadii(30).y, scale / 30);
  }
});

test('large offscreen anchors keep visible skins and their hit area', () => {
  const viewport = { x: 0, y: 0, width: 375, height: 420 };
  const point = { x: 180, y: 700 };
  const size = citySpriteSize(120);
  const body = citySpriteRect(point, size, size * 1.5);
  assert.equal(overlaps(body, viewport), true);
  assert.equal(pickCity({ x: 180, y: 300 }, [{ city: 'large', point, tile: 120, body }], []), 'large');
  assert.equal(overlaps(citySpriteRect(point, citySpriteSize(30), citySpriteSize(30) * 1.5), viewport), false);
});

test('compact badges clamp at each viewport edge and avoid only other badges', () => {
  const viewport = { x: 0, y: 0, width: 375, height: 420 };
  for (const point of [{ x: -20, y: 200 }, { x: 390, y: 200 }, { x: 180, y: -20 }, { x: 180, y: 430 }]) {
    const box = placeCityLabel(point, 32, [], viewport);
    assert.ok(box);
    assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= 375 && box.y + box.height <= 420);
  }
  const occupied = [];
  for (let i = 0; i < 3; i++) {
    const box = placeCityLabel({ x: 180, y: 200 }, 32, occupied, viewport);
    assert.ok(box);
    assert.ok(occupied.every((other) => !overlaps(box, other)));
    occupied.push(box);
  }
});

test('missing city level remains unknown and known levels use compact labels', () => {
  assert.equal(compactCityLevel(null), '—');
  assert.equal(compactCityLevel(undefined), '—');
  assert.equal(compactCityLevel(30), 'Lv.30');
  assert.equal(compactCityLevel(35), 'TG1');
  assert.equal(compactCityLevel(45), 'TG3');
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
