import { useLocale } from '../../lib/locale';
import { playerText, playerText as tr, playerNumberLocale } from '../../lib/player-localization';
import { useEffect, useMemo, useRef, useState } from 'react';
import townCenterIcon from '../../assets/buildings/town-center.webp';
import { groundRadii, pickCities, placeCityLabel, citySpriteRect, citySpriteSize, compactCityLevel, overlaps, MAX_CITY_SCALE, type CityHit, type Rect } from './mapHitGeometry';

export interface MapCity {
  uid: number | string; nick_name?: string | null; power?: number | null; tc?: number | null;
  stove_lv?: number | null; kid?: number | null; map_kid?: number | null; aid?: number | string | null;
  alliance_abbr?: string | null; x: number; y: number; shield_active?: boolean | null;
  burn_active?: boolean | null; city_skin_icon?: string | null;
}
export interface MapAlliance {
  aid: number | string; abbr?: string | null; name?: string | null; city_count?: number | null;
  cx?: number | null; cy?: number | null; power_sum?: number | null; flag_url?: string | null;
}
export interface MapFocus { x: number; y: number; scale?: number }
interface Camera extends MapFocus { scale: number }
interface Props {
  cities: MapCity[]; allCities: MapCity[]; alliances: MapAlliance[]; bounds: { min: number; max: number };
  initialFocus?: MapFocus; focus?: MapFocus | null; selected?: MapCity | null;
  coverageLabel?: string; preserveCameraOnUpdate?: boolean;
  fitAllCities?: boolean;
  onSelect: (city: MapCity) => void;
  onClose: () => void; onLookup: (city: MapCity) => void;
}
export function allianceColor(aid: MapCity['aid']) {
  if (aid == null || String(aid) === '0') return '#9fb0c0';
  let hash = 0;
  for (const char of String(aid)) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `hsl(${hash % 360} 72% 65%)`;
}
export function cityLevel(city: MapCity) {
  const tc = city.tc;
  if (tc == null) return tr("도시 레벨 정보 없음");
  return tc >= 35 ? `${tr("순금 ")}${Math.min(8, Math.floor((tc - 35) / 5) + 1)}` : `${tr("도시 레벨 ")}${tc}`;
}
export function cityImage(path?: string | null) {
  if (!path) return undefined;
  try {
    const url = new URL(path, 'https://mightpulse.com');
    return url.protocol === 'https:' && url.hostname === 'mightpulse.com' ? url.href : undefined;
  } catch { return undefined; }
}
// Choose a local hive, not an alliance-wide average that can land between distant cities.
export function clusterFocus(cities: MapCity[]): MapFocus | undefined {
  if (!cities.length) return undefined;
  const bins = new Map<string, MapCity[]>();
  for (const city of cities) {
    const key = `${Math.floor(city.x / 40)},${Math.floor(city.y / 40)}`;
    const bin = bins.get(key) ?? [];
    bin.push(city); bins.set(key, bin);
  }
  const dense = [...bins.values()].sort((a, b) => b.length - a.length)[0];
  const median = (values: number[]) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
  return { x: median(dense.map((c) => c.x)), y: median(dense.map((c) => c.y)), scale: 30 };
}
function project(x: number, y: number, camera: Camera, width: number, height: number) {
  return { x: ((x - camera.x) - (y - camera.y)) * camera.scale / 2 + width / 2,
    y: -((x - camera.x) + (y - camera.y)) * camera.scale / 2 + height / 2 };
}
function unproject(x: number, y: number, camera: Camera, width: number, height: number) {
  const u = (x - width / 2) / (camera.scale / 2);
  const v = -(y - height / 2) / (camera.scale / 2);
  return { x: (u + v) / 2 + camera.x, y: (v - u) / 2 + camera.y };
}
// Fit projected extrema, including outliers and the tallest supported portrait sprite.
// Symmetric padding also covers the ground marker at low zoom and the sprite's +4px anchor.
export function fitCities(cities: Pick<MapCity, 'x' | 'y'>[], width: number, height: number): Camera | undefined {
  if (!cities.length || !Number.isFinite(width) || !Number.isFinite(height) || width <= 80 || height <= 80) return;
  let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
  for (const city of cities) {
    if (!Number.isFinite(city.x) || !Number.isFinite(city.y)) continue;
    const u = (city.x - city.y) / 2, v = -(city.x + city.y) / 2;
    left = Math.min(left, u); right = Math.max(right, u);
    top = Math.min(top, v); bottom = Math.max(bottom, v);
  }
  if (!Number.isFinite(left)) return;
  const u = (left + right) / 2, v = (top + bottom) / 2;
  return { x: u - v, y: -u - v, scale: Math.min(30, (width - 80) / (right - left + 2.5), (height - 80) / (bottom - top + 7.5)) };
}
const control = 'rounded-lg border border-border bg-raised px-3 py-2 text-sm disabled:opacity-40';

export default function KingdomMapCanvas(props: Props) {
  const { locale } = useLocale();
  const tr = (text: string) => playerText(text, locale);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const wrapper = useRef<HTMLDivElement | null>(null);
  const popup = useRef<HTMLElement | null>(null);
  const hoverTooltip = useRef<HTMLDivElement | null>(null);
  const hoverHighlight = useRef<HTMLDivElement | null>(null);
  const hideHover = useRef<() => void>(() => {});
  const localeRef = useRef(locale);
  localeRef.current = locale;
  const model = useRef(props);
  model.current = props;
  const camera = useRef<Camera>({ x: 600, y: 600, scale: 14 });
  const cameraInitialized = useRef(false);
  const dimensions = useRef({ width: 600, height: 560 });
  const redraw = useRef<() => void>(() => {});
  const closePopup = useRef<() => void>(() => {});
  const [scale, setScale] = useState(14);
  const [candidates, setCandidates] = useState<MapCity[]>([]);
  useEffect(() => { setCandidates([]); }, [props.cities]);
  const coordinates = useRef<HTMLSpanElement | null>(null);
  const coordinateText = useRef<string | null>(null);
  useEffect(() => {
    if (coordinates.current && coordinateText.current === null) {
      coordinates.current.textContent = playerText('도시를 선택해 정보를 확인하세요', locale);
    }
  }, [locale]);
  const pointerRing = useRef<HTMLDivElement | null>(null);
  const [expanded, setExpanded] = useState(false);
  const clusters = useMemo(() => {
    const groups = new Map<string, MapCity[]>();
    for (const city of props.cities) {
      const key = String(city.aid);
      const members = groups.get(key) ?? [];
      members.push(city); groups.set(key, members);
    }
    return props.alliances.flatMap((alliance) => {
      const members = groups.get(String(alliance.aid));
      const focus = members && members.length >= 4 ? clusterFocus(members) : undefined;
      return focus ? [{ alliance, focus }] : [];
    });
  }, [props.cities, props.alliances]);
  const clusterModel = useRef(clusters);
  clusterModel.current = clusters;

  function placePopup() {
    const el = popup.current, city = model.current.selected;
    if (!el || !city) return;
    const { width, height } = dimensions.current;
    const p = project(city.x, city.y, camera.current, width, height);
    const mobile = width < 640;
    el.style.width = `${Math.max(0, Math.min(300, width - 16))}px`;
    el.style.maxHeight = `${Math.max(0, height - 16)}px`;
    el.style.left = `${mobile ? 8 : Math.max(8, Math.min(width - el.offsetWidth - 8, p.x + 22))}px`;
    el.style.top = `${mobile ? Math.max(8, height - el.offsetHeight - 8) : Math.max(8, Math.min(height - el.offsetHeight - 8, p.y - el.offsetHeight / 2))}px`;
  }
  useEffect(() => {
    placePopup();
    if (!popup.current) return;
    const observer = new ResizeObserver(placePopup);
    observer.observe(popup.current);
    return () => observer.disconnect();
  }, [props.selected]);
  useEffect(() => {
    if (!expanded) return;
    const body = document.body, root = document.documentElement;
    const overflow = body.style.overflow, rootOverflow = root.style.overflow;
    body.style.overflow = 'hidden'; root.style.overflow = 'hidden';
    return () => { body.style.overflow = overflow; root.style.overflow = rootOverflow; };
  }, [expanded]);
  useEffect(() => {
    const el = wrapper.current;
    if (!el) return;
    // Controls consume wheel without zooming. Popup keeps its own scrolling.
    const isolate = (e: WheelEvent) => {
      hideHover.current();
      e.stopPropagation();
      const panel = popup.current;
      if (e.target instanceof Node && panel?.contains(e.target)) {
        if (panel.scrollHeight <= panel.clientHeight || (e.deltaY < 0 && panel.scrollTop <= 0)
          || (e.deltaY > 0 && panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 1)) e.preventDefault();
      } else e.preventDefault();
    };
    el.addEventListener('wheel', isolate, { passive: false });
    return () => el.removeEventListener('wheel', isolate);
  }, []);

  function limits() {
    const { min, max } = model.current.bounds;
    const { width, height } = dimensions.current;
    const areaScale = Math.max(0.15, Math.min(width, height) * 0.9 / (max - min));
    const fit = model.current.fitAllCities ? fitCities(model.current.allCities, width, height) : undefined;
    return { min, max, minScale: fit ? Math.min(areaScale, fit.scale) : areaScale };
  }
  function update(next: Camera, fitting = false) {
    hideHover.current();
    const { min, max, minScale } = limits();
    camera.current = { x: fitting ? next.x : Math.max(min, Math.min(max, next.x)), y: fitting ? next.y : Math.max(min, Math.min(max, next.y)), scale: Math.max(minScale, Math.min(MAX_CITY_SCALE, next.scale)) };
    setCandidates((old) => old.length ? [] : old);
    setScale(camera.current.scale); redraw.current();
  }
  function fitVisibleCities() {
    const rect = canvas.current?.getBoundingClientRect();
    if (!rect) return;
    const next = fitCities(model.current.cities, rect.width, rect.height);
    if (next) {
      dimensions.current = { width: rect.width, height: rect.height };
      update(next, true); cameraInitialized.current = true;
    }
  }
  function zoom(factor: number, point = { x: dimensions.current.width / 2, y: dimensions.current.height / 2 }) {
    const { width, height } = dimensions.current;
    const before = unproject(point.x, point.y, camera.current, width, height);
    const next = { ...camera.current, scale: Math.max(limits().minScale, Math.min(MAX_CITY_SCALE, camera.current.scale * factor)) };
    const after = unproject(point.x, point.y, next, width, height);
    update({ ...next, x: next.x + before.x - after.x, y: next.y + before.y - after.y });
  }

  useEffect(() => {
    if (props.fitAllCities) {
      if (!cameraInitialized.current) fitVisibleCities();
      return;
    }
    const largest = [...props.alliances].sort((a, b) => (b.city_count ?? 0) - (a.city_count ?? 0))[0];
    if (props.preserveCameraOnUpdate && cameraInitialized.current) return;
    const members = largest ? props.allCities.filter((c) => String(c.aid) === String(largest.aid)) : props.allCities;
    const initial = props.initialFocus ?? clusterFocus(members) ?? (props.preserveCameraOnUpdate ? clusterFocus(props.allCities) : undefined) ?? { x: 600, y: 600 };
    update({ ...initial, scale: initial.scale ?? 14 });
    cameraInitialized.current = props.allCities.length > 0 || !!props.initialFocus;
    // Profile changes do not reset a map the visitor is exploring.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.allCities, props.bounds]);
  useEffect(() => { if (props.focus) update({ ...props.focus, scale: props.focus.scale ?? 18 }); }, [props.focus]);
  useEffect(() => { redraw.current(); }, [props.cities, props.selected, props.alliances, locale]);

  useEffect(() => {
    // The draw/event loop stays mounted; read current copy without resetting camera or images.
    const tr = playerText;
    const element = canvas.current;
    if (!element) return;
    const ctx = element.getContext('2d');
    if (!ctx) return;
    let frame = 0;
    let disposed = false;
    const images = new Map<string, HTMLImageElement>();
    let hits: CityHit<MapCity>[] = [];
    let labelHits: (Rect & { city: MapCity })[] = [];
    closePopup.current = () => { setCandidates([]); model.current.onClose(); };
    let hudFrame = 0;
    let hudPoint: { x: number; y: number } | null = null;
    let showPointerRing = false;
    let hoverAllowed = false;
    let hoverIdentity: MapCity | undefined;
    let hoverLocale = '';
    const hide = () => {
      hoverAllowed = false;
      if (hoverTooltip.current) hoverTooltip.current.style.visibility = 'hidden';
      if (hoverHighlight.current) hoverHighlight.current.style.visibility = 'hidden';
    };
    hideHover.current = hide;
    const updateCoordinates = (point: { x: number; y: number } | null, pointerType?: string, allowHover = false) => {
      hudPoint = point;
      hoverAllowed = allowHover;
      showPointerRing = pointerType === 'mouse' || pointerType === 'pen';
      if (hudFrame) return;
      hudFrame = window.requestAnimationFrame(() => {
        hudFrame = 0;
        const world = hudPoint && unproject(hudPoint.x, hudPoint.y, camera.current, dimensions.current.width, dimensions.current.height);
        coordinateText.current = world ? `X: ${Math.round(world.x)} · Y: ${Math.round(world.y)}` : null;
        const text = coordinateText.current ?? tr('도시를 선택해 정보를 확인하세요');
        if (coordinates.current && coordinates.current.textContent !== text) coordinates.current.textContent = text;
        const ring = pointerRing.current;
        if (ring) {
          const p = hudPoint, panel = popup.current;
          const overPopup = p && panel && p.x >= panel.offsetLeft && p.x <= panel.offsetLeft + panel.offsetWidth
            && p.y >= panel.offsetTop && p.y <= panel.offsetTop + panel.offsetHeight;
          const visible = showPointerRing && p && p.x >= 0 && p.y >= 0
            && p.x <= dimensions.current.width && p.y <= dimensions.current.height && !overPopup;
          ring.style.visibility = visible ? 'visible' : 'hidden';
          if (visible) ring.style.transform = `translate3d(${p.x - 14}px, ${p.y - 14}px, 0)`;
          const tooltip = hoverTooltip.current, highlight = hoverHighlight.current;
          const city = visible && hoverAllowed && !pointers.size && !frame ? pickCities(p, hits, labelHits)[0] : undefined;
          const hit = city && hits.find((entry) => entry.city === city);
          if (!p || !city || !hit || !tooltip || !highlight) {
            if (tooltip) tooltip.style.visibility = 'hidden';
            if (highlight) highlight.style.visibility = 'hidden';
          } else {
            const lang = localeRef.current;
            if (hoverIdentity !== city || hoverLocale !== lang) {
              const text = (value: string) => playerText(value, lang);
              tooltip.textContent = `${city.nick_name || text('이름 정보 없음')}\n${city.alliance_abbr ? `[${city.alliance_abbr}]` : text('연맹 정보 없음')} · ${compactCityLevel(city.tc)}\n${text('전투력 ')}${city.power?.toLocaleString(lang === 'ko' ? 'ko-KR' : 'en-US') ?? text('정보 없음')}\nX: ${city.x} · Y: ${city.y}`;
              hoverIdentity = city; hoverLocale = lang;
            }
            const { width, height } = dimensions.current;
            tooltip.style.maxWidth = `${Math.max(0, width - 16)}px`;
            tooltip.style.left = `${Math.max(8, Math.min(width - tooltip.offsetWidth - 8, p.x + 18))}px`;
            tooltip.style.top = `${Math.max(8, Math.min(height - tooltip.offsetHeight - 8, p.y + 18))}px`;
            tooltip.style.visibility = 'visible';
            const radius = groundRadii(hit.tile);
            highlight.style.width = `${radius.x * 2}px`; highlight.style.height = `${radius.y * 2}px`;
            highlight.style.transform = `translate3d(${hit.point.x - radius.x}px, ${hit.point.y - radius.y}px, 0)`;
            highlight.style.visibility = 'visible';
          }
        }
      });
    };
    const pointers = new Map<number, { x: number; y: number }>();
    let press: { x: number; y: number; moved: boolean } | null = null;
    let pinchDistance = 0;
    const schedule = () => { if (!disposed && !frame) frame = window.requestAnimationFrame(draw); };
    redraw.current = schedule;
    function image(path?: string | null) {
      // Official profiles omit skins; use our common city icon without a remote dependency.
      const url = cityImage(path) ?? townCenterIcon.src;
      let img = images.get(url);
      if (!img) {
        img = new Image(); images.set(url, img);
        img.onload = schedule; img.onerror = schedule; img.src = url;
      }
      return img.complete && img.naturalWidth > 0 ? img : undefined;
    }
    function draw() {
      frame = 0;
      if (disposed || !ctx || !element) return;
      const { width, height } = dimensions.current;
      if (width < 1 || height < 1) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cam = camera.current;
      const current = model.current;
      placePopup();
      const { min, max } = current.bounds;
      const screen = (x: number, y: number) => project(x, y, cam, width, height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#18272c'; ctx.fillRect(0, 0, width, height);
      const polygon = (points: { x: number; y: number }[], fill: string, stroke?: string) => {
        ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath();
        ctx.fillStyle = fill; ctx.fill();
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
      };
      const region = (lo: number, hi: number, fill: string, stroke: string) => polygon([screen(lo, lo), screen(hi, lo), screen(hi, hi), screen(lo, hi)], fill, stroke);
      region(min, max, '#8b989b', '#b8c6c9');
      region(300, 900, '#73865b', '#a5b77c');
      region(450, 750, '#426a48', '#729970');
      region(552, 648, '#847951', '#d1b774');
      // Deterministic ground texture stays fixed in world coordinates while the camera moves.
      if (cam.scale > 1) for (let x = min + 10; x < max; x += 20) for (let y = min + 10; y < max; y += 20) {
        if (x >= 552 && x <= 648 && y >= 552 && y <= 648) continue;
        const p = screen(x + ((x * 13 + y * 7) % 9), y);
        if (p.x < -20 || p.x > width + 20 || p.y < -20 || p.y > height + 20) continue;
        const green = x > 300 && x < 900 && y > 300 && y < 900;
        polygon([{ x: p.x, y: p.y - 2 }, { x: p.x + 7, y: p.y }, { x: p.x, y: p.y + 2 }, { x: p.x - 7, y: p.y }], green ? '#ffffff0a' : '#ffffff18');
      }
      const gridStep = cam.scale >= 8 ? 10 : cam.scale >= 2 ? 25 : 100;
      ctx.strokeStyle = '#182b2228'; ctx.lineWidth = 0.6; ctx.beginPath();
      for (let value = min; value <= max; value += gridStep) {
        let a = screen(value, min), b = screen(value, max); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
        a = screen(min, value); b = screen(max, value); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      }
      ctx.stroke();
      const label = (text: string, x: number, y: number, color = '#f1f4ee', size = 12) => {
        ctx.font = `600 ${size}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 3; ctx.strokeStyle = '#16251ce6'; ctx.strokeText(text, x, y); ctx.fillStyle = color; ctx.fillText(text, x, y);
      };
      for (const [name, x, y] of [[tr("설원"), 200, 200], [tr("평야"), 365, 365], [tr("비옥한 땅"), 500, 500]] as const) {
        const p = screen(x, y); label(name, p.x, p.y, '#f2eee1', cam.scale < 1 ? 11 : 16);
      }
      // Royal castle at its real coordinate; city skins below are supplied by the map dataset.
      const castle = screen(600, 600);
      const castleSize = Math.max(12, Math.min(150, cam.scale * 6));
      const fallbackCastle = (x: number, y: number, size: number, color: string) => {
        ctx.fillStyle = '#14251d60'; ctx.beginPath(); ctx.ellipse(x, y + 1, size * 0.6, size * 0.18, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = color; ctx.strokeStyle = '#303b37'; ctx.lineWidth = 1;
        ctx.fillRect(x - size * 0.32, y - size * 0.62, size * 0.64, size * 0.58);
        for (const side of [-1, 1]) {
          const tx = x + side * size * 0.28;
          ctx.fillStyle = color; ctx.fillRect(tx - size * 0.13, y - size * 0.8, size * 0.26, size * 0.75);
          polygon([{ x: tx - size * 0.18, y: y - size * 0.8 }, { x: tx, y: y - size * 1.03 }, { x: tx + size * 0.18, y: y - size * 0.8 }], '#355060', '#e2dfbd');
        }
        ctx.fillStyle = '#273b3a'; ctx.fillRect(x - size * 0.09, y - size * 0.3, size * 0.18, size * 0.25);
      };
      if (castle.x > -200 && castle.x < width + 200 && castle.y > -200 && castle.y < height + 200) {
        fallbackCastle(castle.x, castle.y, castleSize, '#d9c17c'); label(tr("왕성"), castle.x, castle.y + 14, '#ffdf84');
      }
      hits = [];
      const size = citySpriteSize(cam.scale);
      const viewport = { x: 0, y: 0, width, height };
      const groundVisible = (point: { x: number; y: number }) => {
        const radius = groundRadii(Math.max(2, cam.scale));
        return overlaps({ x: point.x - radius.x, y: point.y - radius.y, width: radius.x * 2, height: radius.y * 2 }, viewport);
      };
      const visible = current.cities.map((city) => ({ city, point: screen(city.x, city.y) }))
        // Cull before image lookup: maximum skin height is 1.5 times its width.
        .filter(({ point }) => groundVisible(point) || (cam.scale >= 3 && overlaps(citySpriteRect(point, size, size * 1.5), viewport)))
        .map(({ city, point }) => {
        const img = cam.scale >= 3 ? image(city.city_skin_icon) : undefined;
        const spriteHeight = img ? Math.min(size * 1.5, size * img.naturalHeight / img.naturalWidth) : size;
        const body = img ? citySpriteRect(point, size, spriteHeight)
          : { x: point.x - size * 0.368, y: point.y - size * 0.824, width: size * 0.736, height: size * 0.792 };
        return { city, point, img, spriteHeight, body };
      })
        .filter(({ point, body }) => (cam.scale >= 3 && overlaps(body, viewport)) || groundVisible(point))
        .sort((a, b) => a.point.y - b.point.y);
      const labels: { x: number; y: number; width: number; height: number; text: string; city: MapCity; point: { x: number; y: number } }[] = [];
      for (const { city, point: p, img, spriteHeight, body } of visible) {
        const color = allianceColor(city.aid);
        const tile = Math.max(2, cam.scale);
        const chosen = String(city.uid) === String(current.selected?.uid);
        {
          const radius = groundRadii(tile);
          ctx.beginPath(); ctx.ellipse(p.x, p.y, radius.x, radius.y, 0, 0, Math.PI * 2);
          ctx.globalAlpha = chosen ? 0.22 : 0.12; ctx.fillStyle = color; ctx.fill();
          ctx.globalAlpha = chosen ? 1 : 0.35; ctx.strokeStyle = chosen ? '#82ff8b' : color; ctx.lineWidth = chosen ? 2 : 1; ctx.stroke(); ctx.globalAlpha = 1;
        }
        if (cam.scale >= 3) {
          if (img) {
            const rect = citySpriteRect(p, size, spriteHeight);
            ctx.drawImage(img, rect.x, rect.y, rect.width, rect.height);
          }
          else fallbackCastle(p.x, p.y, size * 0.8, '#d0d4cc');
          // The skin host does not allow CORS pixel reads. Match the drawn rectangle
          // and expose all overlaps rather than guessing which sprite owns the pixel.
          hits.push({ city, point: p, tile, body });
          {
            const text = compactCityLevel(city.tc);
            ctx.font = '600 9px system-ui, sans-serif';
            const labelWidth = ctx.measureText(text).width + 8;
            labels.push({ x: 0, y: 0, width: labelWidth, height: 14, text, city, point: p });
          }
        } else hits.push({ city, point: p, tile });
      }
      labelHits = [];
      const occupied: Rect[] = [];
      for (const candidate of labels.sort((a, b) => Number(String(b.city.uid) === String(current.selected?.uid)) - Number(String(a.city.uid) === String(current.selected?.uid)) || b.point.y - a.point.y)) {
        const box = placeCityLabel(candidate.point, candidate.width, occupied, { x: 0, y: 0, width, height });
        if (!box) continue;
        occupied.push(box); labelHits.push({ ...box, city: candidate.city });
        const center = box.x + box.width / 2;
        ctx.strokeStyle = '#12231b99'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(candidate.point.x, candidate.point.y + 3); ctx.lineTo(center, box.y + box.height / 2); ctx.stroke();
        ctx.fillStyle = '#12231bc9'; ctx.fillRect(box.x, box.y, box.width, box.height);
        label(candidate.text, center, box.y + 7, '#ffdf84', 9);
      }
      if (cam.scale < 3) for (const { alliance, focus } of clusterModel.current) {
        const p = screen(focus.x, focus.y); label(`[${alliance.abbr || tr("연맹")}]`, p.x, p.y - 8, allianceColor(alliance.aid), 11);
      }
      // Refresh geometry or language after an existing redraw, never redraw for hover.
      if (hoverAllowed) updateCoordinates(hudPoint, showPointerRing ? 'mouse' : 'touch', true);
    }
    const resize = () => {
      hide();
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      dimensions.current = { width: rect.width, height: rect.height };
      if (model.current.fitAllCities && !cameraInitialized.current) fitVisibleCities();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      element.width = Math.round(rect.width * dpr); element.height = Math.round(rect.height * dpr); schedule();
    };
    const observer = new ResizeObserver(resize); observer.observe(element); resize();
    const position = (e: MouseEvent | PointerEvent) => { const rect = element.getBoundingClientRect(); return { x: e.clientX - rect.left, y: e.clientY - rect.top }; };
    const down = (e: PointerEvent) => {
      hide();
      if (e.button !== 0) return;
      if (frame) { window.cancelAnimationFrame(frame); draw(); }
      const p = position(e); pointers.set(e.pointerId, p); element.setPointerCapture(e.pointerId);
      updateCoordinates(p, e.pointerType);
      if (pointers.size === 1) press = { ...p, moved: false };
      else { if (press) press.moved = true; const [a, b] = [...pointers.values()]; pinchDistance = Math.hypot(a.x - b.x, a.y - b.y); }
    };
    const move = (e: PointerEvent) => {
      const p = position(e);
      const old = pointers.get(e.pointerId);
      if (old) {
        pointers.set(e.pointerId, p);
        if (pointers.size >= 2) {
          const [a, b] = [...pointers.values()]; const distance = Math.hypot(a.x - b.x, a.y - b.y);
          if (pinchDistance > 0) zoom(distance / pinchDistance, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
          pinchDistance = distance;
        } else if (press) {
          if (Math.hypot(p.x - press.x, p.y - press.y) > 4) press.moved = true;
          if (press.moved) {
            const dx = p.x - old.x, dy = p.y - old.y, cam = camera.current;
            update({ ...cam, x: cam.x - (dx - dy) / cam.scale, y: cam.y + (dx + dy) / cam.scale });
          }
        }
      }
      updateCoordinates(p, e.pointerType, !pointers.size);
    };
    const up = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      const p = position(e);
      if (e.type === 'pointerup' && press && !press.moved && Math.hypot(p.x - press.x, p.y - press.y) <= 4 && pointers.size === 1) {
        if (frame) { window.cancelAnimationFrame(frame); draw(); }
        const matches = pickCities(p, hits, labelHits);
        setCandidates(matches.length > 1 ? matches : []);
        const hit = matches[0];
        if (hit) model.current.onSelect(hit);
        else closePopup.current();
      }
      pointers.delete(e.pointerId); pinchDistance = 0;
      if (element.hasPointerCapture(e.pointerId)) element.releasePointerCapture(e.pointerId);
      if (!pointers.size) press = null;
      else if (press) press.moved = true;
      updateCoordinates(e.type === 'pointerup' ? p : null, e.pointerType);
    };
    const wheel = (e: WheelEvent) => { e.preventDefault(); e.stopPropagation(); const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? dimensions.current.height : 1); zoom(Math.exp(-Math.max(-150, Math.min(150, delta)) * 0.004), position(e)); };
    const enter = (e: PointerEvent) => updateCoordinates(position(e), e.pointerType, true);
    const leave = () => { hide(); updateCoordinates(null); };
    element.addEventListener('pointerenter', enter);
    element.addEventListener('pointerdown', down); element.addEventListener('pointermove', move);
    element.addEventListener('pointerup', up); element.addEventListener('pointercancel', up);
    element.addEventListener('lostpointercapture', up);
    element.addEventListener('pointerleave', leave); element.addEventListener('wheel', wheel, { passive: false });
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') { setExpanded(false); closePopup.current(); } };
    window.addEventListener('keydown', escape);
    return () => {
      disposed = true; observer.disconnect(); window.cancelAnimationFrame(frame); redraw.current = () => {};
      hide(); hideHover.current = () => {};
      window.cancelAnimationFrame(hudFrame); closePopup.current = () => {};
      if (pointerRing.current) pointerRing.current.style.visibility = 'hidden';
      element.removeEventListener('pointerenter', enter);
      for (const img of images.values()) { img.onload = null; img.onerror = null; } images.clear();
      element.removeEventListener('pointerdown', down); element.removeEventListener('pointermove', move);
      element.removeEventListener('pointerup', up); element.removeEventListener('pointercancel', up);
      element.removeEventListener('lostpointercapture', up);
      for (const id of pointers.keys()) if (element.hasPointerCapture(id)) element.releasePointerCapture(id);
      element.removeEventListener('pointerleave', leave); element.removeEventListener('wheel', wheel); window.removeEventListener('keydown', escape);
    };
  }, []);

  return <div ref={wrapper} className={expanded ? 'fixed inset-0 z-50 flex flex-col bg-bg p-3 sm:p-5' : 'min-w-0'}>
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <button type="button" className={control} aria-label={tr("지도 확대")} disabled={scale >= MAX_CITY_SCALE} onClick={() => zoom(1.5)}>{tr("확대 ＋")}</button>
      <button type="button" className={control} aria-label={tr("지도 축소")} disabled={scale <= limits().minScale} onClick={() => zoom(1 / 1.5)}>{tr("축소 −")}</button>
      <button type="button" className={control} disabled={props.fitAllCities && !props.cities.length} onClick={() => props.fitAllCities ? fitVisibleCities() : update({ x: (props.bounds.min + props.bounds.max) / 2, y: (props.bounds.min + props.bounds.max) / 2, scale: limits().minScale })}>{props.fitAllCities ? (locale === 'en' ? 'Fit all cities' : '전체 도시 보기') : props.coverageLabel ?? tr("전체 왕국")}</button>
      <button type="button" className={control} onClick={() => update({ x: 600, y: 600, scale: 4 })}>{tr("왕성")}</button>
      <button type="button" className={control} aria-pressed={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? tr("확장 닫기") : tr("화면 확장")}</button>
    </div>
    <div className={`relative min-h-0 overflow-hidden rounded-xl border border-border ${expanded ? 'flex-1' : 'h-[420px] sm:h-[560px]'}`}>
      <canvas ref={canvas} role="img" aria-label={tr("등각 투영 왕국 지도. 휠 또는 확대 버튼으로 확대하고 드래그하여 이동할 수 있습니다. 아래 도시 목록으로도 영주를 선택할 수 있습니다.")} className="block h-full w-full touch-none" style={{ cursor: 'none' }} />
      <div ref={pointerRing} aria-hidden="true" className="pointer-events-none absolute left-0 top-0 rounded-full" style={{ width: 28, height: 28, boxSizing: 'border-box', border: '2px solid #82ff8b', background: '#70ff7918', visibility: 'hidden', willChange: 'transform' }} />
      <div ref={hoverHighlight} aria-hidden="true" className="pointer-events-none absolute left-0 top-0 rounded-full border-2 border-[#82ff8b] bg-[#70ff7922]" style={{ visibility: 'hidden' }} />
      <div ref={hoverTooltip} role="tooltip" className="pointer-events-none absolute z-[5] whitespace-pre-line break-words rounded-lg border border-border bg-raised px-3 py-2 text-xs text-text shadow-lg" style={{ visibility: 'hidden', maxWidth: 280 }} />
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-bg/85 px-3 py-2 text-xs text-text"><span ref={coordinates}>{coordinateText.current ?? tr("도시를 선택해 정보를 확인하세요")}</span><span className="mt-1 block text-muted">{tr("휠·두 손가락으로 확대 · 드래그로 이동")}</span></div>
      <div className="pointer-events-none absolute right-3 top-3 rounded-md bg-bg/85 px-2 py-1 text-xs text-muted">{tr("배율 ")}{scale.toFixed(1)}</div>
      {props.selected && <section ref={popup} aria-label={tr("선택한 도시 정보")} className="absolute z-10 overflow-y-auto overscroll-contain rounded-xl border border-accent/50 bg-raised p-4 shadow-xl" style={{ left: 8, top: 8, width: 'min(300px, calc(100% - 16px))', maxHeight: 'calc(100% - 16px)' }}>
        {candidates.length > 1 && <div className="mb-3 border-b border-border pb-3">
          <p className="mb-2 text-xs text-muted">{locale === 'ko' ? '겹친 도시 선택' : 'Choose an overlapping city'} ({candidates.length})</p>
          <div className="flex flex-col gap-1">{candidates.map((city) => <button type="button" key={city.uid} aria-pressed={String(city.uid) === String(props.selected?.uid)} className="rounded border border-border px-2 py-2 text-left text-xs aria-pressed:border-accent" onClick={() => model.current.onSelect(city)}>
            {city.alliance_abbr ? `[${city.alliance_abbr}] ` : ''}{city.nick_name || tr('이름 정보 없음')} · {city.x}, {city.y}
          </button>)}</div>
        </div>}
        <div className="flex items-start justify-between gap-3"><h3 className="min-w-0 break-words font-bold [overflow-wrap:anywhere]">{props.selected.nick_name || tr("이름 정보 없음")}</h3><button type="button" className="shrink-0 rounded px-2 py-1 hover:bg-bg" aria-label={tr("도시 정보 닫기")} onClick={() => closePopup.current()}>✕</button></div>
        <p className="mt-1 text-sm text-muted">{props.selected.alliance_abbr ? `[${props.selected.alliance_abbr}]` : tr("연맹 정보 없음")} · {cityLevel(props.selected)}</p>
        <p className="mt-3 text-sm">X: {props.selected.x} · Y: {props.selected.y}</p>
        <p className="mt-1 text-sm">{tr("전투력 ")}{props.selected.power?.toLocaleString(playerNumberLocale()) ?? tr("정보 없음")}</p>
        <p className="mt-2 text-xs text-muted">{tr("저장 시점 보호막: ")}{props.selected.shield_active == null ? tr("정보 없음") : props.selected.shield_active ? tr("있음") : tr("없음")}{tr(" · 연소: ")}{props.selected.burn_active == null ? tr("정보 없음") : props.selected.burn_active ? tr("있음") : tr("없음")}</p>
        <button type="button" className="mt-4 w-full rounded-lg bg-accent px-4 py-3 font-bold text-on-accent" onClick={() => { setExpanded(false); props.onLookup(props.selected!); }}>{tr("장비 보기")}</button>
      </section>}
    </div>
  </div>;
}
