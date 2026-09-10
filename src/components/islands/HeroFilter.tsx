import { useCallback, useEffect, useRef, useState } from 'react';
import {
  RARITY_ORDER,
  RARITY_RANK,
  TROOP_CLASSES,
  rarityLabel,
  type Rarity,
} from '@/lib/labels';

/**
 * 영웅 목록 필터.
 *
 * 카드 자체는 Astro가 서버에서 전부 그려두고, 이 아일랜드는 DOM 표시만 토글한다.
 * 그래서 JS가 꺼져 있어도 34명 전원이 그대로 보인다(검색엔진 대응).
 */

const GENERATIONS = [1, 2, 3, 4, 5, 6, 7] as const;
const RARITIES = RARITY_ORDER;
const CLASSES = TROOP_CLASSES;

const SORTS = [
  { value: 'gen', label: '세대순' },
  { value: 'rarity', label: '등급순' },
  { value: 'name', label: '이름순' },
] as const;

type Sort = (typeof SORTS)[number]['value'];

interface Props {
  /** 카드 그리드 컨테이너의 id */
  targetId: string;
  total: number;
}

interface CardMeta {
  el: HTMLElement;
  gen: number;
  rarity: string;
  troopClass: string;
  order: number;
  name: string;
  nameEn: string;
}

function readCards(container: HTMLElement): CardMeta[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[data-hero-card]')).map((el) => ({
    el,
    gen: Number(el.dataset.gen ?? 0),
    rarity: el.dataset.rarity ?? '',
    troopClass: el.dataset.class ?? '',
    order: Number(el.dataset.order ?? 0),
    name: el.dataset.name ?? '',
    nameEn: el.dataset.nameEn ?? '',
  }));
}

function parseList(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export default function HeroFilter({ targetId, total }: Props) {
  const [gens, setGens] = useState<number[]>([]);
  const [rarities, setRarities] = useState<string[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('gen');
  const [shown, setShown] = useState(total);
  const ready = useRef(false);

  // 최초 1회: 쿼리스트링에서 상태 복원 → 공유된 링크가 그대로 열린다
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const g = parseList(p.get('gen'))
      .map(Number)
      .filter((n) => GENERATIONS.includes(n as (typeof GENERATIONS)[number]));
    const r = parseList(p.get('rarity')).filter((v) =>
      (RARITIES as readonly string[]).includes(v),
    );
    const c = parseList(p.get('class')).filter((v) => (CLASSES as readonly string[]).includes(v));
    const s = p.get('sort');
    if (g.length) setGens(g);
    if (r.length) setRarities(r);
    if (c.length) setClasses(c);
    if (p.get('q')) setQuery(p.get('q') as string);
    if (s === 'gen' || s === 'rarity' || s === 'name') setSort(s);
    ready.current = true;
  }, []);

  const apply = useCallback(() => {
    const container = document.getElementById(targetId);
    if (!container) return;

    const cards = readCards(container);
    const q = query.trim().toLowerCase();

    let visible = 0;
    for (const card of cards) {
      const ok =
        (gens.length === 0 || gens.includes(card.gen)) &&
        (rarities.length === 0 || rarities.includes(card.rarity)) &&
        (classes.length === 0 || classes.includes(card.troopClass)) &&
        (q === '' || card.name.toLowerCase().includes(q) || card.nameEn.includes(q));

      card.el.hidden = !ok;
      if (ok) visible += 1;
    }
    setShown(visible);

    // 정렬은 CSS order 로 처리 — DOM 을 옮기지 않아 깜빡임이 없다
    const sorted = [...cards].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name, 'ko');
      if (sort === 'rarity') {
        const rank = (r: string) => RARITY_RANK[r as Rarity] ?? 9;
        const diff = rank(a.rarity) - rank(b.rarity);
        if (diff !== 0) return diff;
      }
      return a.order - b.order;
    });
    sorted.forEach((card, i) => {
      card.el.style.order = String(i);
    });

    // 링크 공유용 쿼리스트링 반영
    const params = new URLSearchParams();
    if (gens.length) params.set('gen', gens.slice().sort((a, b) => a - b).join(','));
    if (rarities.length) params.set('rarity', rarities.join(','));
    if (classes.length) params.set('class', classes.join(','));
    if (q) params.set('q', query.trim());
    if (sort !== 'gen') params.set('sort', sort);
    const qs = params.toString();
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  }, [targetId, gens, rarities, classes, query, sort]);

  useEffect(() => {
    apply();
  }, [apply]);

  const hasFilter = gens.length > 0 || rarities.length > 0 || classes.length > 0 || query !== '';

  const reset = () => {
    setGens([]);
    setRarities([]);
    setClasses([]);
    setQuery('');
    setSort('gen');
  };

  const chip = (active: boolean) =>
    [
      'rounded-lg border px-2.5 py-1 text-sm font-semibold transition-colors',
      active
        ? 'border-accent bg-accent text-on-accent'
        : 'border-border bg-surface text-muted hover:border-accent/50 hover:text-text',
    ].join(' ');

  return (
    <div className="rounded-xl border border-border bg-surface/60 p-4 sm:p-5">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="sr-only" htmlFor="hero-search">
            영웅 이름 검색
          </label>
          <input
            id="hero-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            placeholder="이름 검색 (예: 로사, rosa)"
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-muted sm:max-w-xs"
          />
          <div className="flex items-center gap-2 sm:ml-auto">
            <label className="text-sm text-muted" htmlFor="hero-sort">
              정렬
            </label>
            <select
              id="hero-sort"
              value={sort}
              onChange={(e) => setSort(e.currentTarget.value as Sort)}
              className="rounded-lg border border-border bg-bg px-2.5 py-2 text-sm text-text"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <fieldset className="flex flex-wrap items-center gap-2">
          <legend className="sr-only">세대</legend>
          <span className="mr-1 text-sm font-semibold text-muted">세대</span>
          {GENERATIONS.map((g) => (
            <button
              key={g}
              type="button"
              aria-pressed={gens.includes(g)}
              onClick={() => setGens((prev) => toggle(prev, g))}
              className={chip(gens.includes(g))}
            >
              {g}
            </button>
          ))}
        </fieldset>

        <fieldset className="flex flex-wrap items-center gap-2">
          <legend className="sr-only">등급</legend>
          <span className="mr-1 text-sm font-semibold text-muted">등급</span>
          {RARITIES.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={rarities.includes(r)}
              onClick={() => setRarities((prev) => toggle(prev, r))}
              className={chip(rarities.includes(r))}
              title={r}
            >
              {rarityLabel(r)}
            </button>
          ))}
        </fieldset>

        <fieldset className="flex flex-wrap items-center gap-2">
          <legend className="sr-only">병종</legend>
          <span className="mr-1 text-sm font-semibold text-muted">병종</span>
          {CLASSES.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={classes.includes(c)}
              onClick={() => setClasses((prev) => toggle(prev, c))}
              className={chip(classes.includes(c))}
            >
              {c}
            </button>
          ))}
        </fieldset>

        <div className="flex items-center gap-3 border-t border-border pt-3 text-sm text-muted">
          <span aria-live="polite">
            {shown === total ? `영웅 ${total}명` : `${total}명 중 ${shown}명`}
          </span>
          {hasFilter && (
            <button
              type="button"
              onClick={reset}
              className="rounded-lg border border-border px-2.5 py-1 font-semibold text-text hover:border-accent/50 hover:text-accent"
            >
              필터 초기화
            </button>
          )}
        </div>

        {shown === 0 && (
          <p className="rounded-lg border border-border bg-bg px-3 py-4 text-center text-sm text-muted">
            조건에 맞는 영웅이 없습니다. 필터를 조금 풀어보세요.
          </p>
        )}
      </div>
    </div>
  );
}
