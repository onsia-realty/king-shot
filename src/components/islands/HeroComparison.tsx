import { useEffect, useMemo, useState } from 'react';
import { RARITY_LABEL, TROOP_CLASS_GLYPH, type Rarity, type TroopClass } from '@/lib/labels';

/**
 * 영웅 비교 도구.
 *
 * 콘텐츠 컬렉션의 image() 필드는 서버에서만 다룰 수 있어서,
 * .astro 페이지가 초상화를 최적화된 src 문자열로 바꿔 넘겨준다.
 * 이 아일랜드는 넘어온 평범한 객체만 보고 화면을 그린다.
 */

export type SkillMode = '토벌' | '원정' | '특성';

export interface ComparisonSkill {
  name: string;
  nameEn: string;
  mode: SkillMode;
  /** 만렙 수치 (levels 의 마지막 값) */
  max?: string;
  /** 두 번째 수치 줄의 만렙 값 */
  max2?: string;
}

export interface ComparisonHero {
  id: string;
  name: string;
  nameEn: string;
  generation: number;
  rarity: Rarity;
  troopClass: TroopClass;
  acquisition: string;
  summary: string;
  heroClass?: string;
  /** 최적화를 마친 초상화 경로. 없으면 등급색 이니셜로 대체한다 */
  portrait?: string;
  exploration?: { attack: number; defense: number; hp: number };
  expedition?: { attack: string; defense: string };
  skills: ComparisonSkill[];
  gearName?: string;
}

interface Props {
  heroes: ComparisonHero[];
}

const RARITY_RING: Record<Rarity, string> = {
  SSR: 'ring-rarity-ssr',
  SR: 'ring-rarity-sr',
  R: 'ring-rarity-r',
  N: 'ring-rarity-n',
};

/** 등급 배지 색. Tailwind 가 스캔할 수 있게 문자열을 통째로 적어 둔다 */
const RARITY_BADGE: Record<Rarity, string> = {
  SSR: 'text-rarity-ssr border-rarity-ssr/45 bg-rarity-ssr/12',
  SR: 'text-rarity-sr border-rarity-sr/45 bg-rarity-sr/12',
  R: 'text-rarity-r border-rarity-r/45 bg-rarity-r/12',
  N: 'text-rarity-n border-rarity-n/45 bg-rarity-n/12',
};

const SKILL_GROUPS: SkillMode[] = ['토벌', '원정', '특성'];

const EXPLORATION_ROWS = [
  { key: 'attack', label: '공격력' },
  { key: 'defense', label: '방어력' },
  { key: 'hp', label: 'HP' },
] as const;

const EXPEDITION_ROWS = [
  { key: 'attack', label: '공격력' },
  { key: 'defense', label: '방어력' },
] as const;

const num = (value: number) => value.toLocaleString('ko-KR');

/** "370.29%" 같은 문자열에서 숫자만 뽑는다. 못 뽑으면 강조 없이 값만 보여준다 */
function parsePercent(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const matched = value.replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  if (!matched) return undefined;
  const parsed = Number(matched[0]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** 소수점이 남으면 최대 두 자리까지만 */
function trimDecimal(value: number): string {
  return value.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
}

type Verdict = 'win' | 'lose' | 'tie' | 'none';

function compare(mine?: number, theirs?: number): Verdict {
  if (mine === undefined || theirs === undefined) return 'none';
  if (mine > theirs) return 'win';
  if (mine < theirs) return 'lose';
  return 'tie';
}

const VALUE_CLASS: Record<Verdict, string> = {
  win: 'text-accent',
  lose: 'text-muted',
  tie: 'text-text',
  none: 'text-text',
};

function StatRow({
  label,
  display,
  verdict,
  diff,
}: {
  label: string;
  display: string;
  verdict: Verdict;
  diff?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-border py-2 first:border-t-0">
      <span className="text-xs text-muted">{label}</span>
      <span className="flex items-baseline gap-2 tabular-nums">
        <span className={`text-sm font-bold ${VALUE_CLASS[verdict]}`}>{display}</span>
        {verdict === 'win' && diff && (
          <span className="rounded-md border border-accent/40 bg-accent/12 px-1.5 py-0.5 text-[11px] font-bold text-accent">
            +{diff}
          </span>
        )}
      </span>
    </div>
  );
}

function HeroColumn({ hero, other }: { hero: ComparisonHero; other?: ComparisonHero }) {
  const rarityVar = `var(--ks-rarity-${hero.rarity.toLowerCase()})`;
  const placeholderStyle = {
    backgroundImage: `linear-gradient(150deg, color-mix(in oklab, ${rarityVar} 45%, transparent), color-mix(in oklab, ${rarityVar} 8%, transparent) 65%, transparent)`,
    color: rarityVar,
  };

  const skillsByMode = SKILL_GROUPS.map((mode) => ({
    mode,
    list: hero.skills.filter((skill) => skill.mode === mode),
  })).filter((group) => group.list.length > 0);

  return (
    <article className="flex flex-col gap-5 rounded-xl border border-border bg-surface p-4 sm:p-5">
      <header className="flex items-center gap-3">
        <div
          className={
            hero.portrait
              ? `flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-raised ring-2 ring-inset ${RARITY_RING[hero.rarity]}`
              : 'flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border text-2xl font-extrabold'
          }
          style={hero.portrait ? undefined : placeholderStyle}
          aria-hidden={hero.portrait ? undefined : 'true'}
        >
          {hero.portrait ? (
            <img
              src={hero.portrait}
              alt={`${hero.name} (${hero.nameEn}) 초상`}
              width={128}
              height={128}
              loading="lazy"
              decoding="async"
              className="size-16 object-cover"
            />
          ) : (
            hero.name.trim().slice(0, 1)
          )}
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-lg font-bold leading-tight">
            <a href={`/heroes/${hero.id}/`} className="text-text no-underline hover:text-accent">
              {hero.name}
            </a>
          </h3>
          <p className="truncate text-xs text-muted">{hero.nameEn}</p>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-bold tracking-wide ${RARITY_BADGE[hero.rarity]}`}
          title={`${RARITY_LABEL[hero.rarity]} 등급 (${hero.rarity})`}
        >
          {RARITY_LABEL[hero.rarity]}
        </span>
        <span className="inline-flex items-center gap-1 rounded-md border border-border bg-raised px-1.5 py-0.5 text-[11px] font-bold text-muted">
          <span aria-hidden="true">{TROOP_CLASS_GLYPH[hero.troopClass]}</span>
          {hero.troopClass}
        </span>
        <span className="inline-flex items-center rounded-md border border-border bg-raised px-1.5 py-0.5 text-[11px] font-bold text-muted">
          {hero.generation}세대
        </span>
        {hero.heroClass && (
          <span className="inline-flex items-center rounded-md border border-border bg-raised px-1.5 py-0.5 text-[11px] font-bold text-muted">
            {hero.heroClass}형
          </span>
        )}
        <span className="inline-flex items-center rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted">
          획득: {hero.acquisition}
        </span>
      </div>

      <p className="text-sm leading-relaxed text-muted">{hero.summary}</p>

      <section>
        <h4 className="text-sm font-bold text-accent">토벌</h4>
        <div className="mt-1.5">
          {EXPLORATION_ROWS.map((row) => {
            const mine = hero.exploration?.[row.key];
            const theirs = other?.exploration?.[row.key];
            const verdict = compare(mine, theirs);
            return (
              <StatRow
                key={row.key}
                label={row.label}
                display={mine === undefined ? '—' : num(mine)}
                verdict={verdict}
                diff={
                  verdict === 'win' && mine !== undefined && theirs !== undefined
                    ? num(mine - theirs)
                    : undefined
                }
              />
            );
          })}
        </div>
      </section>

      <section>
        <h4 className="text-sm font-bold text-accent">원정</h4>
        <div className="mt-1.5">
          {EXPEDITION_ROWS.map((row) => {
            const raw = hero.expedition?.[row.key];
            const mine = parsePercent(raw);
            const theirs = parsePercent(other?.expedition?.[row.key]);
            const verdict = compare(mine, theirs);
            return (
              <StatRow
                key={row.key}
                label={row.label}
                display={raw ?? '—'}
                verdict={verdict}
                diff={
                  verdict === 'win' && mine !== undefined && theirs !== undefined
                    ? `${trimDecimal(mine - theirs)}%p`
                    : undefined
                }
              />
            );
          })}
        </div>
      </section>

      <section>
        <h4 className="text-sm font-bold text-accent">스킬</h4>
        {skillsByMode.length === 0 ? (
          <p className="mt-1.5 text-sm text-muted">아직 정리된 스킬이 없습니다.</p>
        ) : (
          skillsByMode.map((group) => (
            <div key={group.mode} className="mt-2">
              <h5 className="text-xs font-bold text-muted">{group.mode}</h5>
              <ul className="mt-1 flex flex-col gap-1">
                {group.list.map((skill) => (
                  <li
                    key={`${group.mode}-${skill.nameEn}`}
                    className="flex items-baseline justify-between gap-3 text-sm"
                  >
                    <span className="min-w-0 truncate">{skill.name}</span>
                    {(skill.max || skill.max2) && (
                      <span className="shrink-0 font-bold text-accent tabular-nums">
                        {[skill.max, skill.max2].filter(Boolean).join(' / ')}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>

      <section>
        <h4 className="text-sm font-bold text-accent">전용 장비</h4>
        <p className="mt-1.5 text-sm">{hero.gearName ?? <span className="text-muted">없음</span>}</p>
      </section>
    </article>
  );
}

export default function HeroComparison({ heroes }: Props) {
  const [leftId, setLeftId] = useState(heroes[0]?.id ?? '');
  const [rightId, setRightId] = useState(heroes[1]?.id ?? '');

  const byId = useMemo(() => new Map(heroes.map((hero) => [hero.id, hero])), [heroes]);

  // 최초 1회: 쿼리스트링 복원 → 비교 결과를 링크로 공유할 수 있다
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const a = params.get('a');
    const b = params.get('b');
    if (a && byId.has(a)) setLeftId(a);
    if (b && byId.has(b)) setRightId(b);
  }, [byId]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (leftId) params.set('a', leftId);
    if (rightId) params.set('b', rightId);
    const qs = params.toString();
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  }, [leftId, rightId]);

  const left = byId.get(leftId);
  const right = byId.get(rightId);

  const selectClass =
    'w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text';

  const options = heroes.map((hero) => (
    <option key={hero.id} value={hero.id}>
      {hero.name} ({hero.nameEn}) · {hero.generation}세대 {RARITY_LABEL[hero.rarity]}
    </option>
  ));

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-surface/60 p-4 sm:grid-cols-2 sm:p-5">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-muted" htmlFor="hero-a">
            첫 번째 영웅
          </label>
          <select
            id="hero-a"
            className={selectClass}
            value={leftId}
            onChange={(e) => setLeftId(e.currentTarget.value)}
          >
            <option value="">선택 안 함</option>
            {options}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-muted" htmlFor="hero-b">
            두 번째 영웅
          </label>
          <select
            id="hero-b"
            className={selectClass}
            value={rightId}
            onChange={(e) => setRightId(e.currentTarget.value)}
          >
            <option value="">선택 안 함</option>
            {options}
          </select>
        </div>
        {left && right && left.id === right.id && (
          <p className="text-sm text-muted sm:col-span-2">
            같은 영웅을 두 번 골랐습니다. 한쪽을 다른 영웅으로 바꾸면 차이가 보입니다.
          </p>
        )}
      </div>

      {left || right ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {left && <HeroColumn hero={left} other={right} />}
          {right && <HeroColumn hero={right} other={left} />}
        </div>
      ) : (
        <p className="rounded-xl border border-border bg-surface px-4 py-6 text-center text-sm text-muted">
          위에서 영웅을 골라주세요. 두 명을 고르면 토벌 스탯이 높은 쪽에 색과 차이값이 붙습니다.
        </p>
      )}
    </div>
  );
}
