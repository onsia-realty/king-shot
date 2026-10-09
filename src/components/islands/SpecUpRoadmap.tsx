import { useEffect, useMemo, useState } from 'react';
import { PACKAGE_GENERATIONS, type PackageGeneration } from '@/data/package-ref';
import {
  costGrade,
  GOVERNOR_GEAR_TIERS,
  HERO_GEAR_MAX_LEVEL,
  JEWEL_MAX_LEVEL,
  MASTERY_MAX_LEVEL,
  type CostGrade,
} from '@/data/spec-up';
import {
  HERO_GEAR_SLOT_LABELS,
  normalizeCharacter,
  recommendRoadmap,
  ROADMAP_CATEGORY_LABELS,
  ROADMAP_WEIGHTS,
  SAMPLE_CHARACTER,
  STAT_LABELS,
  TROOP_LABELS,
  TROOPS,
  type CharacterInfo,
  type RoadmapCategory,
  type RoadmapMode,
  type Troop,
} from '@/data/spec-up-roadmap';

/**
 * 스펙업 로드맵. 위에서 캐릭터 상태를 입력하고, 아래에 효율 순 추천 30개를 보여준다.
 * 추천은 src/data/spec-up-roadmap.ts 순수 함수가 하고, 여기서는 입력·저장·표시만 한다.
 * 입력은 localStorage 에 저장한다. 저장을 못 하는 환경이어도 화면은 그대로 동작한다.
 * 처음엔 예시 캐릭터가 채워져 있고, 하나라도 바꾸면 "내 결과"로 바뀐다.
 */

const STORAGE_KEY = 'kingshot-spec-up-roadmap';

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const HERO_LEVEL_OPTIONS = range(0, HERO_GEAR_MAX_LEVEL).map((v) => ({ value: v, label: `Lv.${v}` }));
const MASTERY_OPTIONS = range(0, MASTERY_MAX_LEVEL).map((v) => ({ value: v, label: `M.${v}` }));
const JEWEL_OPTIONS = range(0, JEWEL_MAX_LEVEL).map((v) => ({ value: v, label: `Lv.${v}` }));
const GOVERNOR_OPTIONS = [
  { value: -1, label: '없음' },
  ...GOVERNOR_GEAR_TIERS.map((label, value) => ({ value, label })),
];

const MODES: readonly { key: RoadmapMode; label: string; desc: string }[] = [
  { key: 'all', label: '전체', desc: '세 병종 전부, 체력·파괴력 ×1.1 / 공격·방어 ×1.0' },
  { key: 'bear', label: '곰 우선', desc: '궁병만, 체력·방어는 0으로 보고 공격·파괴력만' },
];

const CATEGORY_STYLE: Record<RoadmapCategory, string> = {
  hero_gear: 'border-border text-muted',
  hero_mastery: 'border-accent/60 text-accent-strong',
  governor_gear: 'border-warning/60 text-warning',
  jewel: 'border-success/60 text-success',
};

const GRADE_STYLE: Record<CostGrade, string> = {
  good: 'border-success/60 text-success',
  fair: 'border-border text-muted',
  poor: 'border-warning/60 text-warning',
  bad: 'border-danger/60 text-danger',
};

function fmt(n: number): string {
  return n.toLocaleString('ko-KR');
}

/** 스펙업 계산기와 같은 표기: 1만 이상은 만 단위 소수 한 자리, 미만은 원 단위 */
function fmtKrw(n: number): string {
  if (n >= 10000) {
    const man = n / 10000;
    const text =
      n % 10000 === 0 ? fmt(man) : man.toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    return `₩${text}만`;
  }
  return `₩${fmt(Math.round(n))}`;
}

const fieldClass = 'w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm text-text';
const labelClass = 'mb-1 block text-xs font-semibold text-muted';
const badgeClass = 'rounded-full border px-2 py-0.5 text-xs font-bold whitespace-nowrap';

function Select(props: {
  id: string;
  label: string;
  value: number;
  options: readonly { value: number; label: string }[];
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <label className={labelClass} htmlFor={props.id}>
        {props.label}
      </label>
      <select
        id={props.id}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.currentTarget.value))}
        className={fieldClass}
      >
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function TroopForm({
  troop,
  character,
  update,
}: {
  troop: Troop;
  character: CharacterInfo;
  update: (fn: (c: CharacterInfo) => CharacterInfo) => void;
}) {
  const t = TROOP_LABELS[troop];
  const jewels = character.governorJewels.find((j) => j.troop === troop)!;

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="text-sm font-bold">{t} 영웅 장비</legend>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {character.heroGear
            .filter((g) => g.troop === troop)
            .map((g) => {
              const slot = HERO_GEAR_SLOT_LABELS[g.slot];
              const set = (patch: { level?: number; mastery?: number }) =>
                update((c) => ({
                  ...c,
                  heroGear: c.heroGear.map((x) => (x.troop === troop && x.slot === g.slot ? { ...x, ...patch } : x)),
                }));
              return (
                <div key={g.slot} className="rounded-lg border border-border bg-bg p-2">
                  <p className="mb-1.5 text-sm font-semibold">{slot}</p>
                  <div className="space-y-2">
                    <Select id={`rm-${troop}-${g.slot}-lv`} label={`${slot} 레벨`} value={g.level} options={HERO_LEVEL_OPTIONS} onChange={(level) => set({ level })} />
                    <Select id={`rm-${troop}-${g.slot}-m`} label={`${slot} 마스터리`} value={g.mastery} options={MASTERY_OPTIONS} onChange={(mastery) => set({ mastery })} />
                  </div>
                </div>
              );
            })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-bold">{t} 영주 장비</legend>
        <div className="mt-2 grid grid-cols-2 gap-3">
          {character.governorGear
            .filter((g) => g.troop === troop)
            .map((g) => (
              <Select
                key={g.slotIndex}
                id={`rm-${troop}-gov-${g.slotIndex}`}
                label={`슬롯${g.slotIndex} 티어`}
                value={g.tier}
                options={GOVERNOR_OPTIONS}
                onChange={(tier) =>
                  update((c) => ({
                    ...c,
                    governorGear: c.governorGear.map((x) =>
                      x.troop === troop && x.slotIndex === g.slotIndex ? { ...x, tier } : x,
                    ),
                  }))
                }
              />
            ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-bold">{t} 영주 보석</legend>
        <div className="mt-2 grid grid-cols-3 gap-3 sm:grid-cols-6">
          {jewels.levels.map((lv, i) => (
            <Select
              key={i}
              id={`rm-${troop}-jewel-${i + 1}`}
              label={`${i + 1}칸`}
              value={lv}
              options={JEWEL_OPTIONS}
              onChange={(level) =>
                update((c) => ({
                  ...c,
                  governorJewels: c.governorJewels.map((j) =>
                    j.troop === troop ? { ...j, levels: j.levels.map((v, k) => (k === i ? level : v)) } : j,
                  ),
                }))
              }
            />
          ))}
        </div>
      </fieldset>
    </div>
  );
}

export default function SpecUpRoadmap() {
  const [character, setCharacter] = useState<CharacterInfo>(SAMPLE_CHARACTER);
  const [edited, setEdited] = useState(false);
  const [troop, setTroop] = useState<Troop>('infantry');
  const [mode, setMode] = useState<RoadmapMode>('all');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const c = saved ? normalizeCharacter(JSON.parse(saved)) : null;
      if (c) {
        setCharacter(c);
        setEdited(true);
      }
    } catch {
      // 저장소를 못 쓰거나 저장값이 깨졌으면 예시로 둔다.
    }
  }, []);

  function update(fn: (c: CharacterInfo) => CharacterInfo) {
    const next = fn(character);
    setCharacter(next);
    setEdited(true);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // 기억 못 해도 추천엔 지장 없다.
    }
  }

  function reset() {
    setCharacter(SAMPLE_CHARACTER);
    setEdited(false);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // 지울 수 없으면 다음 방문 때 저장값이 다시 뜰 뿐이다.
    }
  }

  const items = useMemo(() => recommendRoadmap(character, mode), [character, mode]);
  const gen = PACKAGE_GENERATIONS.find((g) => g.key === character.generation)!;
  const w = ROADMAP_WEIGHTS[mode];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-surface/60 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">내 캐릭터 정보</h2>
          {edited ? (
            <button
              type="button"
              onClick={reset}
              className="rounded-lg border border-border bg-bg px-3 py-1.5 text-sm font-semibold text-muted hover:text-text"
            >
              예시로 되돌리기
            </button>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-muted">
          {edited
            ? '입력한 내용은 이 브라우저에만 저장됩니다.'
            : '지금은 예시 캐릭터가 채워져 있습니다. 내 장비 상태로 바꾸면 바로 내 추천으로 바뀝니다.'}
        </p>

        <div className="mt-4">
          <label className="mb-1.5 block text-sm font-semibold text-muted" htmlFor="rm-generation">
            세대 (패키지 단가 기준)
          </label>
          <select
            id="rm-generation"
            value={character.generation}
            onChange={(e) => {
              const generation = e.currentTarget.value as PackageGeneration;
              update((c) => ({ ...c, generation }));
            }}
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text"
          >
            {PACKAGE_GENERATIONS.map((g) => (
              <option key={g.key} value={g.key}>
                {g.name}
                {g.predicted ? ' (예측)' : ''}
              </option>
            ))}
          </select>
          {gen.predicted ? (
            <p className="mt-2 text-xs text-warning">이 세대는 패키지 구성이 예측치라 비용도 예측치입니다.</p>
          ) : null}
        </div>

        <div role="tablist" aria-label="병종" className="mt-5 flex flex-wrap gap-2">
          {TROOPS.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              id={`rm-tab-${t}`}
              aria-selected={t === troop}
              aria-controls="rm-troop-panel"
              onClick={() => setTroop(t)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors ${
                t === troop ? 'border-accent bg-accent/15 text-accent-strong' : 'border-border bg-bg text-muted hover:text-text'
              }`}
            >
              {TROOP_LABELS[t]}
            </button>
          ))}
        </div>
        <div id="rm-troop-panel" role="tabpanel" aria-labelledby={`rm-tab-${troop}`} className="mt-4">
          <TroopForm troop={troop} character={character} update={update} />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface/60 p-4 sm:p-5">
        <h2 className="text-lg font-bold">{edited ? '추천 순서' : '샘플 결과 (예시)'}</h2>
        {!edited ? (
          <p className="mt-1 text-sm text-warning">
            위 예시 캐릭터 기준 결과입니다. 내 장비 상태를 입력하면 내 추천으로 바뀝니다.
          </p>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-2" role="group" aria-label="추천 모드">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              aria-pressed={m.key === mode}
              onClick={() => setMode(m.key)}
              className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                m.key === mode ? 'border-accent bg-accent/15 text-accent-strong' : 'border-border bg-bg text-muted hover:text-text'
              }`}
            >
              <span className="block font-bold">{m.label}</span>
              <span className="block text-xs">{m.desc}</span>
            </button>
          ))}
        </div>

        <div className="mt-4" aria-live="polite">
          {items.length === 0 ? (
            <p className="rounded-lg border border-border bg-bg px-3 py-4 text-center text-sm text-muted">
              {mode === 'all' ? '모든 장비가 최대 레벨입니다.' : '이 조건의 장비가 모두 최대 레벨입니다.'}
            </p>
          ) : (
            <ol className="space-y-3">
              {items.map((x) => (
                <li
                  key={`${x.category}-${x.troop}-${x.slotLabel}-${x.currentState}`}
                  className={`rounded-xl border p-3 sm:p-4 ${x.rank <= 3 ? 'border-success/60 bg-success/5' : 'border-border bg-bg'}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                          x.rank <= 3 ? 'bg-success text-bg' : 'bg-raised text-muted'
                        }`}
                      >
                        {x.rank}
                      </span>
                      <span className={`${badgeClass} ${CATEGORY_STYLE[x.category]}`}>{ROADMAP_CATEGORY_LABELS[x.category]}</span>
                      <span className={`${badgeClass} border-border text-muted`}>{TROOP_LABELS[x.troop]}</span>
                    </div>
                    <span className={`${badgeClass} ${GRADE_STYLE[costGrade(x.costPer1Percent)]}`}>
                      1%당 {fmtKrw(x.costPer1Percent)}
                    </span>
                  </div>
                  <p className="mt-2 font-bold">
                    {x.slotLabel} · {x.currentState} → {x.nextTarget}
                  </p>
                  <p className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm tabular-nums">
                    <span className="text-muted">
                      성능 +{x.rawStatGain.toFixed(2)}% ({x.affectedStats.map((s) => STAT_LABELS[s]).join('+')})
                    </span>
                    <span className="font-semibold">비용 {fmtKrw(x.totalCostKRW)}</span>
                  </p>
                  {x.resources.length > 0 ? (
                    <p className="mt-2 border-t border-border pt-2 text-xs text-muted">
                      {x.resources.map((r) => `${r.name} ${fmt(r.amount)}`).join(' · ')}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="mt-5 rounded-xl border border-border bg-bg px-4 py-3 text-sm">
          <p className="font-semibold">추천 점수 가중치 ({MODES.find((m) => m.key === mode)!.label})</p>
          <ul className="mt-2 grid grid-cols-2 gap-1 text-muted tabular-nums">
            {(['hp', 'destruction', 'attack', 'defense'] as const).map((s) => (
              <li key={s}>
                {STAT_LABELS[s]} ×{w[s].toFixed(1)}
              </li>
            ))}
          </ul>
          <ul className="mt-2 space-y-1 text-xs text-muted">
            <li>갑옷·장갑: 체력 · 헬멧·신발: 파괴력 · 마스터리: 슬롯 스탯과 같음</li>
            <li>승급 보너스 — 갑옷·헬멧: 공격→방어→공격 · 장갑·신발: 방어→공격→방어 (120·160·200레벨)</li>
            <li>영주 장비: 공격+방어 · 영주 보석: 체력+파괴력 (두 가중치 평균)</li>
            <li>동점이면 보병방어 &gt; 궁병공격 &gt; 기병공격 &gt; 궁병방어 &gt; 보병공격 &gt; 기병방어, 영주 장비·보석은 보병 &gt; 궁병 &gt; 기병</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
