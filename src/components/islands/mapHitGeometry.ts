export interface Point { x: number; y: number }
export interface Rect extends Point { width: number; height: number }
export interface CityHit<T> {
  city: T; point: Point; tile: number; body?: Rect;
}
const contains = (p: Point, r: Rect) => p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
export const MAX_CITY_SCALE = 120;
export const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
export function citySpriteRect(point: Point, size: number, height: number): Rect {
  return { x: point.x - size / 2, y: point.y - height + 4, width: size, height };
}
export const citySpriteSize = (scale: number) => scale * 2.5;
export const compactCityLevel = (tc?: number | null) => tc == null ? '—' : tc >= 35 ? `TG${Math.min(8, Math.floor((tc - 35) / 5) + 1)}` : `Lv.${tc}`;

export function placeCityLabel(point: Point, width: number, occupied: Rect[], viewport: Rect): Rect | undefined {
  if (width > viewport.width || viewport.height < 14) return;
  for (const dy of [6, 22, -18, 38]) for (const dx of [0, -width / 2 - 4, width / 2 + 4]) {
    const box = { x: Math.max(viewport.x, Math.min(viewport.x + viewport.width - width, point.x - width / 2 + dx)), y: Math.max(viewport.y, Math.min(viewport.y + viewport.height - 14, point.y + dy)), width, height: 14 };
    if (!occupied.some((other) => overlaps(box, other))) return box;
  }
}

// Match the small ground selection ellipse, not the decorative alliance tile.
export function groundRadii(tile: number) {
  return { x: Math.max(2, tile * 0.55), y: Math.max(1.5, tile * 0.32) };
}

// Labels are painted last; bodies use paint order, then nearest ground.
export function pickCity<T>(p: Point, cities: CityHit<T>[], labels: (Rect & { city: T })[]): T | undefined {
  return pickCities(p, cities, labels)[0];
}

// Keep every overlapping candidate reachable, with the visible label/body first.
export function pickCities<T>(p: Point, cities: CityHit<T>[], labels: (Rect & { city: T })[]): T[] {
  const result: T[] = [];
  const add = (city: T) => { if (!result.includes(city)) result.push(city); };
  for (let i = labels.length - 1; i >= 0; i--) if (contains(p, labels[i])) add(labels[i].city);
  for (let i = cities.length - 1; i >= 0; i--) {
    const hit = cities[i];
    if (hit.body && contains(p, hit.body)) add(hit.city);
  }
  const grounds = cities.map((hit, index) => {
    const radius = groundRadii(hit.tile);
    const d = ((p.x - hit.point.x) / radius.x) ** 2 + ((p.y - hit.point.y) / radius.y) ** 2;
    return { hit, d, index };
  }).filter(({ d }) => d <= 1).sort((a, b) => a.d - b.d || b.index - a.index);
  for (const { hit } of grounds) add(hit.city);
  return result;
}
