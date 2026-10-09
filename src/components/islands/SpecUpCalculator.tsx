import { useState } from 'react';
import { PACKAGE_GENERATIONS, type PackageGeneration } from '@/data/package-ref';
import {
  calculateGovernorGear,
  calculateHeroGear,
  calculateJewel,
  costGrade,
  GOVERNOR_GEAR_MAX_TIER,
  GOVERNOR_GEAR_TIERS,
  HERO_GEAR_MAX_LEVEL,
  JEWEL_MAX_LEVEL,
  MASTERY_MAX_LEVEL,
  type CostGrade,
  type SpecUpStep,
  type SpecUpTotals,
} from '@/data/spec-up';

/**
 * 스펙업 계산기. 탭 3개(영웅 장비·영주 장비·영주 보석)가 세대 선택을 공유한다.
 * 계산은 전부 src/data/spec-up.ts 순수 함수가 하고, 여기서는 입력·표시만 한다.
 * 입력은 select 라 범위를 벗어난 값이 들어오지 않는다. 현재 > 목표면 계산하지 않고 안내만 띄운다.
 */

type Tab = 'hero' | 'governor' | 'jewel';

const TABS: readonly { key: Tab; label: string }[] = [
  { key: 'hero', label: '영웅 장비' },
  { key: 'governor', label: '영주 장비' },
  { key: 'jewel', label: '영주 보석' },
];

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const HERO_LEVELS = range(0, HERO_GEAR_MAX_LEVEL);
const MASTERY_LEVELS = range(0, MASTERY_MAX_LEVEL);
const JEWEL_LEVELS = range(0, JEWEL_MAX_LEVEL);
const GOVERNOR_OPTIONS = [
  { value: -1, label: '없음' },
  ...GOVERNOR_GEAR_TIERS.map((label, value) => ({ value, label })),
];

function fmt(n: number): string {
  return n.toLocaleString('ko-KR');
}

/** 원본 표기를 따른다: 1만 이상은 만 단위 소수 한 자리(딱 떨어지면 정수), 미만은 원 단위. */
function fmtKrw(n: number): string {
  if (n >= 10000) {
    const man = n / 10000;
    const text =
      n % 10000 === 0 ? fmt(man) : man.toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    return `₩${text}만`;
  }
  return `₩${fmt(Math.round(n))}`;
}

/** 단가는 1원 미만도 나와서 크기에 따라 소수 자릿수를 다르게 둔다. */
function fmtUnit(n: number): string {
  if (n >= 10000) return fmtKrw(n);
  const digits = n < 1 ? 2 : n < 100 ? 1 : 0;
  return `₩${n.toLocaleString('ko-KR', { maximumFractionDigits: digits })}`;
}

function fmtPct(n: number, digits = 1): string {
  return `${n.toFixed(digits)}%`;
}

const GRADE_STYLE: Record<CostGrade, { label: string; className: string }> = {
  good: { label: '효율 좋음', className: 'border-success/60 text-success' },
  fair: { label: '보통', className: 'border-border text-muted' },
  poor: { label: '비쌈', className: 'border-warning/60 text-warning' },
  bad: { label: '매우 비쌈', className: 'border-danger/60 text-danger' },
};

function GradeBadge({ value }: { value: number }) {
  const g = GRADE_STYLE[costGrade(value)];
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-bold whitespace-nowrap ${g.className}`}>
      {g.label}
    </span>
  );
}

const fieldClass = 'w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text';
const labelClass = 'mb-1.5 block text-sm font-semibold text-muted';

function LevelSelect(props: {
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

const levelOptions = (levels: readonly number[], prefix = 'Lv.') =>
  levels.map((lv) => ({ value: lv, label: `${prefix}${lv}` }));

function Summary({ total }: { total: SpecUpTotals }) {
  const tiles = [
    { label: '총 비용', value: fmtKrw(total.costKRW) },
    { label: '총 성능 증가', value: `+${fmtPct(total.statGain)}` },
    { label: '1%당 비용', value: total.statGain > 0 ? fmtKrw(total.costPer1Percent) : '-' },
  ];
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-xl border border-border bg-raised p-4">
          <p className="text-sm text-muted">{t.label}</p>
          <p className="mt-1 text-2xl font-extrabold tabular-nums text-accent-strong">{t.value}</p>
        </div>
      ))}
    </div>
  );
}

function UnitPrices({ rows }: { rows: readonly { label: string; value: number }[] }) {
  return (
    <div className="mt-3 rounded-xl border border-border bg-bg px-4 py-3">
      <p className="text-sm font-semibold">단가 정보</p>
      <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted tabular-nums">
        {rows.map((r) => (
          <li key={r.label}>
            {r.label} <span className="font-semibold text-text">{fmtUnit(r.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 구간별 효율표 */
function StepTable({ title, steps }: { title: string; steps: readonly SpecUpStep[] }) {
  if (steps.length === 0) return null;
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-bg">
      <table className="w-full border-collapse text-sm">
        <caption className="px-4 py-3 text-left font-semibold">{title}</caption>
        <thead>
          <tr className="bg-raised text-left">
            <th scope="col" className="px-4 py-3 font-bold whitespace-nowrap">
              구간
            </th>
            <th scope="col" className="px-4 py-3 font-bold whitespace-nowrap">
              재료
            </th>
            <th scope="col" className="px-4 py-3 text-right font-bold whitespace-nowrap">
              비용
            </th>
            <th scope="col" className="px-4 py-3 text-right font-bold whitespace-nowrap">
              성능
            </th>
            <th scope="col" className="px-4 py-3 text-right font-bold whitespace-nowrap">
              1%당
            </th>
          </tr>
        </thead>
        <tbody>
          {steps.map((s) => (
            <tr key={s.label} className={`border-t border-border ${s.milestone ? 'bg-accent/5' : ''}`}>
              <th scope="row" className="px-4 py-3 text-left font-bold whitespace-nowrap">
                {s.label}
              </th>
              <td className="px-4 py-3 text-muted">
                {s.items.map((it) => `${it.name} ${fmt(it.amount)}`).join(' · ')}
              </td>
              <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">{fmtKrw(s.costKRW)}</td>
              <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                +{fmtPct(s.statGain + s.promotionBonus, 2)}
                {s.promotionBonus > 0 ? (
                  <span className="block text-xs text-muted">승급 보너스 +{s.promotionBonus}% 포함</span>
                ) : null}
              </td>
              <td className="px-4 py-3 text-right whitespace-nowrap">
                <span className="tabular-nums">{fmtKrw(s.costPer1Percent)}</span>{' '}
                <GradeBadge value={s.costPer1Percent} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Invalid({ children }: { children: string }) {
  return (
    <p className="rounded-lg border border-border bg-bg px-3 py-4 text-center text-sm text-muted">{children}</p>
  );
}

function HeroPanel({ generation }: { generation: PackageGeneration }) {
  const [fromLevel, setFromLevel] = useState(80);
  const [toLevel, setToLevel] = useState(100);
  const [masteryFrom, setMasteryFrom] = useState(5);
  const [masteryTo, setMasteryTo] = useState(8);

  const invalid = fromLevel > toLevel || masteryFrom > masteryTo || (fromLevel === toLevel && masteryFrom === masteryTo);
  const r = invalid ? null : calculateHeroGear({ generation, fromLevel, toLevel, masteryFrom, masteryTo });

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <LevelSelect id="su-hero-from" label="장비 현재 레벨" value={fromLevel} options={levelOptions(HERO_LEVELS)} onChange={setFromLevel} />
        <LevelSelect id="su-hero-to" label="장비 목표 레벨" value={toLevel} options={levelOptions(HERO_LEVELS)} onChange={setToLevel} />
        <LevelSelect id="su-mastery-from" label="마스터리 현재" value={masteryFrom} options={levelOptions(MASTERY_LEVELS)} onChange={setMasteryFrom} />
        <LevelSelect id="su-mastery-to" label="마스터리 목표" value={masteryTo} options={levelOptions(MASTERY_LEVELS)} onChange={setMasteryTo} />
      </div>
      <div className="mt-5 border-t border-border pt-5" aria-live="polite">
        {r ? (
          <>
            <Summary total={r.total} />
            <UnitPrices
              rows={[
                { label: 'EXP 1', value: r.prices.expKRW },
                { label: '망치 1개', value: r.prices.hammerKRW },
                { label: '미스릴 1개', value: r.prices.mithrilKRW },
                { label: '신화 장비 1개', value: r.prices.mythicGearKRW },
              ]}
            />
            <StepTable title={`장비 레벨 (소계 ${fmtKrw(r.leveling.costKRW)} / +${fmtPct(r.leveling.statGain)})`} steps={r.levelingSteps} />
            <StepTable
              title={`마스터리 — Lv.${toLevel} 장비 기준 단계당 +${fmtPct(r.masterySteps[0]?.statGain ?? 0)} (소계 ${fmtKrw(r.mastery.costKRW)})`}
              steps={r.masterySteps}
            />
          </>
        ) : (
          <Invalid>목표 레벨을 현재 레벨 이상으로, 둘 중 하나는 더 높게 설정해 주세요.</Invalid>
        )}
      </div>
    </>
  );
}

function GovernorPanel({ generation }: { generation: PackageGeneration }) {
  const [fromTier, setFromTier] = useState(-1);
  const [toTier, setToTier] = useState(GOVERNOR_GEAR_MAX_TIER);
  const r = fromTier < toTier ? calculateGovernorGear({ generation, fromTier, toTier }) : null;

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <LevelSelect id="su-gov-from" label="현재 티어" value={fromTier} options={GOVERNOR_OPTIONS} onChange={setFromTier} />
        <LevelSelect id="su-gov-to" label="목표 티어" value={toTier} options={GOVERNOR_OPTIONS} onChange={setToTier} />
      </div>
      <div className="mt-5 border-t border-border pt-5" aria-live="polite">
        {r ? (
          <>
            <Summary total={r.total} />
            <UnitPrices
              rows={[
                { label: '비단 1개', value: r.prices.satinKRW },
                { label: '금사 1개', value: r.prices.threadKRW },
                { label: '스케치 1개', value: r.prices.sketchKRW },
              ]}
            />
            <StepTable title="티어별 비용 (장비 한 부위 기준)" steps={r.steps} />
          </>
        ) : (
          <Invalid>목표 티어를 현재 티어보다 높게 설정해 주세요.</Invalid>
        )}
      </div>
    </>
  );
}

function JewelPanel({ generation }: { generation: PackageGeneration }) {
  const [fromLevel, setFromLevel] = useState(0);
  const [toLevel, setToLevel] = useState(JEWEL_MAX_LEVEL);
  const r = fromLevel < toLevel ? calculateJewel({ generation, fromLevel, toLevel }) : null;

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <LevelSelect id="su-jewel-from" label="현재 레벨" value={fromLevel} options={levelOptions(JEWEL_LEVELS)} onChange={setFromLevel} />
        <LevelSelect id="su-jewel-to" label="목표 레벨" value={toLevel} options={levelOptions(JEWEL_LEVELS)} onChange={setToLevel} />
      </div>
      <div className="mt-5 border-t border-border pt-5" aria-live="polite">
        {r ? (
          <>
            <Summary total={r.total} />
            <UnitPrices rows={[{ label: '매뉴얼·도면 1개', value: r.unitPriceKRW }]} />
            <StepTable title="레벨별 비용 (보석 한 개 기준)" steps={r.steps} />
          </>
        ) : (
          <Invalid>목표 레벨을 현재 레벨보다 높게 설정해 주세요.</Invalid>
        )}
      </div>
    </>
  );
}

export default function SpecUpCalculator() {
  const [tab, setTab] = useState<Tab>('hero');
  const [generation, setGeneration] = useState<PackageGeneration>('gold_123');
  const gen = PACKAGE_GENERATIONS.find((g) => g.key === generation)!;

  return (
    <div className="rounded-xl border border-border bg-surface/60 p-4 sm:p-5">
      <div role="tablist" aria-label="스펙업 항목" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`su-tab-${t.key}`}
            aria-selected={t.key === tab}
            aria-controls="su-panel"
            onClick={() => setTab(t.key)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors ${
              t.key === tab
                ? 'border-accent bg-accent/15 text-accent-strong'
                : 'border-border bg-bg text-muted hover:text-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        <label className={labelClass} htmlFor="su-generation">
          세대 (패키지 단가 기준)
        </label>
        <select
          id="su-generation"
          value={generation}
          onChange={(e) => setGeneration(e.currentTarget.value as PackageGeneration)}
          className={fieldClass}
        >
          {PACKAGE_GENERATIONS.map((g) => (
            <option key={g.key} value={g.key}>
              {g.name}
              {g.predicted ? ' (예측)' : ''}
            </option>
          ))}
        </select>
        {gen.predicted ? (
          <p className="mt-2 text-xs text-warning">
            이 세대는 패키지 구성이 예측치라 비용도 예측치입니다.
          </p>
        ) : null}
      </div>

      <div id="su-panel" role="tabpanel" aria-labelledby={`su-tab-${tab}`} className="mt-5">
        {tab === 'hero' ? <HeroPanel generation={generation} /> : null}
        {tab === 'governor' ? <GovernorPanel generation={generation} /> : null}
        {tab === 'jewel' ? <JewelPanel generation={generation} /> : null}
      </div>
    </div>
  );
}
