export interface Point { x: number; y: number }
export interface Rect extends Point { width: number; height: number }
export interface CityHit<T> {
  city: T; point: Point; tile: number; body?: Rect;
}
const contains = (p: Point, r: Rect) => p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;

// Match the small ground selection ellipse, not the decorative alliance tile.
export function groundRadii(tile: number) {
  return { x: Math.max(2, tile * 0.55), y: Math.max(1.5, tile * 0.32) };
}

// Labels are painted last. Compact ground ownership disambiguates nearby bodies.
export function pickCity<T>(p: Point, cities: CityHit<T>[], labels: (Rect & { city: T })[]): T | undefined {
  for (let i = labels.length - 1; i >= 0; i--) if (contains(p, labels[i])) return labels[i].city;
  let best: T | undefined;
  let distance = Infinity;
  for (const hit of cities) {
    const radius = groundRadii(hit.tile);
    const d = ((p.x - hit.point.x) / radius.x) ** 2 + ((p.y - hit.point.y) / radius.y) ** 2;
    if (d <= 1 && d <= distance) { best = hit.city; distance = d; }
  }
  if (best !== undefined) return best;
  distance = Infinity;
  for (const hit of cities) {
    if (!hit.body || !contains(p, hit.body)) continue;
    const body = hit.body;
    const d = Math.hypot((p.x - hit.point.x) / (body.width / 2), (p.y - (body.y + body.height / 2)) / (body.height / 2));
    if (d <= distance) { best = hit.city; distance = d; }
  }
  return best;
}
