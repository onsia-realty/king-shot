import { useMemo, useState } from 'react';
import { PACKAGE_GENERATIONS, type PackageGeneration } from '@/data/package-ref';
import {
  DAILY_DOUBLE,
  EV_FULL_SYNTH,
  EV_NO_SYNTH,
  FREE_TOKENS,
  SLOT_PACKAGE,
  TOKEN_MILESTONES,
  TOKEN_PACKAGES,
  TOKEN_SCENARIOS,
  WIND_PACKAGES,
  WIND_REWARDS,
  evaluateTokenPlan,
  optimizeTokens,
  planWind,
  planWindMax,
  rankEventPackages,
  windItemUnitPrice,
  windMarginalTable,
  type Grade,
  type MarginalGrade,
  type WindItem,
} from '@/data/pack-value';

/**
 * 패키지 계산기. 탭 세 개(효율 랭킹 / 토큰 최적화 / 바람을 쫓는 여행).
 * 계산은 전부 src/data/pack-value.ts 의 순수 함수가 하고, 여기서는 입력과 표시만 맡는다.
 */

type Tab = 'ranking' | 'tokens' | 'wind';

const TABS: readonly { key: Tab; label: string }[] = [
  { key: 'ranking', label: '효율 랭킹' },
  { key: 'tokens', label: '토큰 최적화' },
  { key: 'wind', label: '바람을 쫓는 여행' },
];

function fmt(n: number): string {
  return n.toLocaleString('ko-KR', { maximumFractionDigits: 1 });
}

function won(n: number): string {
  return `${Math.round(n).toLocaleString('ko-KR')}원`;
}

const fieldClass =
  'w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-muted';
const labelClass = 'mb-1.5 block text-sm font-semibold text-muted';
const thClass = 'px-3 py-2 font-bold whitespace-nowrap';
const tdNum = 'px-3 py-2 text-right tabular-nums whitespace-nowrap';

function chipClass(active: boolean): string {
  return `rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors ${
    active ? 'border-accent bg-accent/15 text-accent-strong' : 'border-border bg-bg text-muted hover:text-text'
  }`;
}

const GRADE_CLASS: Record<Grade, string> = {
  S: 'border-success/60 text-success',
  A: 'border-accent/60 text-accent-strong',
  B: 'border-border text-text',
  C: 'border-warning/60 text-warning',
  D: 'border-danger/60 text-danger',
};

const MARGINAL_LABEL: Record<MarginalGrade, { label: string; cls: string }> = {
  best: { label: '최고', cls: 'text-success' },
  good: { label: '좋음', cls: 'text-accent-strong' },
  fair: { label: '보통', cls: 'text-muted' },
  poor: { label: '비효율', cls: 'text-danger' },
};

/* ───────── 1. 효율 랭킹 ───────── */

function RankingPanel() {
  const ranked = useMemo(() => rankEventPackages(), []);
  return (
    <div>
      <p className="text-sm text-muted">
        순금 4/5세대 기준 패키지(7,500원) 단가로 구성품을 원화 환산해 더한 뒤 가격으로 나눴습니다.
        효율 100% = 기준 패키지와 같은 값어치입니다. 등급: S 150% 이상 · A 120% · B 100% · C 80% · D 그
        미만.
      </p>
      <ol className="mt-4 space-y-3">
        {ranked.map((r) => (
          <li key={r.pkg.id} className="rounded-xl border border-border bg-bg">
            <details>
              <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                <span className="font-extrabold tabular-nums text-muted">{r.rank}위</span>
                <span className="font-bold">
                  {r.pkg.eventName} {r.pkg.packageName}
                  {r.pkg.maxPurchases !== null ? (
                    <span className="ml-1 text-xs text-muted">({r.pkg.maxPurchases}회 한정)</span>
                  ) : null}
                </span>
                <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${GRADE_CLASS[r.grade]}`}>
                  {r.grade}
                </span>
                <span className="ml-auto text-right text-sm tabular-nums">
                  효율 <strong className="text-accent-strong">{Math.round(r.ratio * 100)}%</strong>
                  <span className="text-muted"> · 가치 {won(r.totalValueKRW)}</span>
                </span>
              </summary>
              <div className="overflow-x-auto border-t border-border">
                <table className="w-full border-collapse text-sm">
                  <caption className="sr-only">{r.pkg.packageName} 구성품별 환산가</caption>
                  <thead>
                    <tr className="bg-raised text-left">
                      <th scope="col" className={thClass}>구성품</th>
                      <th scope="col" className={`${thClass} text-right`}>수량</th>
                      <th scope="col" className={`${thClass} text-right`}>개당 단가</th>
                      <th scope="col" className={`${thClass} text-right`}>환산가</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.items.map((i, idx) => (
                      <tr key={idx} className="border-t border-border">
                        <th scope="row" className="px-3 py-2 text-left font-semibold">{i.name}</th>
                        <td className={tdNum}>{fmt(i.amount)}</td>
                        <td className={tdNum}>{fmt(i.unitPriceKRW)}원</td>
                        <td className={tdNum}>{won(i.valueKRW)}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-border bg-raised">
                      <th scope="row" className="px-3 py-2 text-left font-bold">합계 / 가격</th>
                      <td className={tdNum} colSpan={2}>
                        이벤트 토큰 {fmt(r.pkg.tokens)}
                      </td>
                      <td className={`${tdNum} font-bold`}>
                        {won(r.totalValueKRW)} / {won(r.pkg.priceKRW)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </details>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-muted">
        가속은 7,500원 = 119시간으로 환산합니다. 특별아이템은 망치 개수로 환산해 망치 단가를 매깁니다.
      </p>
    </div>
  );
}

/* ───────── 2. 토큰 최적화 ───────── */

function TokenPanel() {
  const [targetRaw, setTargetRaw] = useState('1000');
  const [scenarioIdx, setScenarioIdx] = useState(0);

  const target = Math.max(0, Math.floor(Number(targetRaw) || 0));
  const plan = useMemo(() => optimizeTokens(target), [target]);
  const set = TOKEN_SCENARIOS[scenarioIdx];

  return (
    <div>
      <p className="text-sm text-muted">
        목표 진행 토큰을 넣으면 일반 패키지 7종(각 5회)과 일일퀘스트 2배권({won(DAILY_DOUBLE.price)}, +
        {DAILY_DOUBLE.tokens}) 조합을 전부 따져 가장 싼 조합을 찾습니다. 무료 토큰 {FREE_TOKENS}개(기본 40 +
        일일퀘스트 100)는 자동으로 포함합니다.
      </p>

      <div className="mt-4">
        <label className={labelClass} htmlFor="pv-token-target">
          목표 진행 토큰
        </label>
        <input
          id="pv-token-target"
          type="number"
          min={0}
          step={10}
          inputMode="numeric"
          value={targetRaw}
          onChange={(e) => setTargetRaw(e.currentTarget.value)}
          className={`${fieldClass} tabular-nums sm:max-w-xs`}
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {TOKEN_MILESTONES.map((m) => (
            <button
              key={m.milestone}
              type="button"
              onClick={() => setTargetRaw(String(m.milestone))}
              className={chipClass(target === m.milestone)}
            >
              {fmt(m.milestone)}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-border bg-raised p-4" aria-live="polite">
        {plan === null ? (
          <p className="text-sm text-danger">
            모든 패키지를 최대로 사도 {fmt(target)}토큰에 닿지 않습니다. 최대 진행 토큰은 10,040입니다.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted">{fmt(target)}토큰 최소 비용</p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums text-accent-strong sm:text-3xl">
              {plan.totalCost === 0 ? '무료' : won(plan.totalCost)}
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-muted">진행 토큰</dt>
                <dd className="font-bold tabular-nums">{fmt(plan.progressTokens)}</dd>
              </div>
              <div>
                <dt className="text-muted">마일스톤 보너스</dt>
                <dd className="font-bold tabular-nums">+{fmt(plan.bonusTokens)}</dd>
              </div>
              <div>
                <dt className="text-muted">최종 토큰</dt>
                <dd className="font-bold tabular-nums">{fmt(plan.finalTokens)}</dd>
              </div>
              <div>
                <dt className="text-muted">토큰당 (최종 기준)</dt>
                <dd className="font-bold tabular-nums">
                  {plan.totalCost > 0 ? `${fmt(plan.totalCost / plan.finalTokens)}원` : '-'}
                </dd>
              </div>
            </dl>
            {plan.totalCost > 0 ? (
              <ul className="mt-3 flex flex-wrap gap-2 text-sm">
                {plan.useDouble ? (
                  <li className="rounded-lg border border-border bg-bg px-2.5 py-1">2배권 ×1</li>
                ) : null}
                {TOKEN_PACKAGES.map((p, i) =>
                  plan.counts[i] > 0 ? (
                    <li key={p.price} className="rounded-lg border border-border bg-bg px-2.5 py-1 tabular-nums">
                      {won(p.price)} ×{plan.counts[i]}
                    </li>
                  ) : null,
                )}
              </ul>
            ) : null}
          </>
        )}
      </div>

      <h3 className="mt-8 font-bold">목표별 시나리오 비교</h3>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="시나리오 목표">
        {TOKEN_SCENARIOS.map((s, i) => (
          <button key={s.target} type="button" onClick={() => setScenarioIdx(i)} className={chipClass(i === scenarioIdx)}>
            {fmt(s.target)}
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm text-muted">{set.summary}</p>
      <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-bg">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{fmt(set.target)}토큰 시나리오 비교 (모두 2배권 포함)</caption>
          <thead>
            <tr className="bg-raised text-left">
              <th scope="col" className={thClass}>시나리오</th>
              <th scope="col" className={thClass}>구성 (2배권 포함)</th>
              <th scope="col" className={`${thClass} text-right`}>총 비용</th>
              <th scope="col" className={`${thClass} text-right`}>진행 / 최종</th>
              <th scope="col" className={`${thClass} text-right`}>최종 토큰당</th>
            </tr>
          </thead>
          <tbody>
            {set.scenarios.map((sc) => {
              const p = evaluateTokenPlan(set.target, true, sc.counts);
              const tone =
                sc.tone === 'best' ? 'text-success' : sc.tone === 'danger' ? 'text-danger' : sc.tone === 'good' ? 'text-accent-strong' : '';
              return (
                <tr key={sc.name} className="border-t border-border align-top">
                  <th scope="row" className="px-3 py-2 text-left">
                    <span className={`font-bold ${tone}`}>{sc.name}</span>
                    <span className="mt-0.5 block text-xs font-normal text-muted">{sc.note}</span>
                  </th>
                  <td className="px-3 py-2 text-xs text-muted">
                    {TOKEN_PACKAGES.map((pk, i) => (sc.counts[i] > 0 ? `${fmt(pk.price)}×${sc.counts[i]}` : null))
                      .filter(Boolean)
                      .join(' + ')}
                  </td>
                  <td className={tdNum}>{won(p.totalCost)}</td>
                  <td className={tdNum}>
                    {fmt(p.progressTokens)} / {fmt(p.finalTokens)}
                  </td>
                  <td className={tdNum}>{fmt(p.totalCost / p.finalTokens)}원</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ───────── 3. 바람을 쫓는 여행 ───────── */

const WIND_TARGETS: readonly (number | 'max')[] = [...WIND_REWARDS.map((r) => r.boxes), 'max'];

function WindPanel() {
  const [target, setTarget] = useState<number | 'max'>(350);
  const [item, setItem] = useState<WindItem>('blueprint');
  const [stage, setStage] = useState<PackageGeneration>('war_academy');
  const [useSlot, setUseSlot] = useState(true);

  const itemName = item === 'blueprint' ? '보석 도면' : '스케치';
  const price = windItemUnitPrice(stage, item);
  const plan = useMemo(() => (target === 'max' ? planWindMax(useSlot) : planWind(target, useSlot)), [target, useSlot]);
  const table = useMemo(() => windMarginalTable(useSlot), [useSlot]);

  const valueKRW = plan.totalValue * price;
  const net = valueKRW - plan.totalCost;

  return (
    <div>
      <p className="text-sm text-muted">
        패키지는 가속(시간)만 주고 {8}시간당 상자 1개라서, 시간당 싼 패키지부터 5회씩 채우는 게 항상
        최소 비용입니다({WIND_PACKAGES.map((p) => fmt(p.price)).join(' → ')}원). 달성보상은 누적이라
        마일스톤마다 추가 비용 대비 추가 보상(한계효용)이 다릅니다.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <span className={labelClass}>가치 기준 아이템</span>
          <div className="flex gap-2">
            {(['blueprint', 'sketch'] as const).map((k) => (
              <button key={k} type="button" onClick={() => setItem(k)} className={chipClass(item === k)}>
                {k === 'blueprint' ? '보석 도면' : '스케치'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className={labelClass} htmlFor="pv-wind-stage">
            세대 (개당 {fmt(price)}원)
          </label>
          <select
            id="pv-wind-stage"
            value={stage}
            onChange={(e) => setStage(e.currentTarget.value as PackageGeneration)}
            className={fieldClass}
          >
            {PACKAGE_GENERATIONS.map((g) => (
              <option key={g.key} value={g.key}>
                {g.name}
                {g.predicted ? ' (예측)' : ''}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-start gap-2 text-sm sm:pt-7">
          <input
            type="checkbox"
            checked={useSlot}
            onChange={(e) => setUseSlot(e.currentTarget.checked)}
            className="mt-0.5"
          />
          <span>
            <span className="font-semibold">슬롯 증설 패키지 사용</span>
            <span className="block text-xs text-muted">
              {won(SLOT_PACKAGE.price)}에 상자 {SLOT_PACKAGE.freeBoxes}개 무료 (5일, 8시간 간격)
            </span>
          </span>
        </label>
      </div>

      <h3 className="mt-6 font-bold">마일스톤 한계효용</h3>
      <div className="mt-2 overflow-x-auto rounded-xl border border-border bg-bg">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">마일스톤별 추가 비용과 추가 보상</caption>
          <thead>
            <tr className="bg-raised text-left">
              <th scope="col" className={thClass}>도달 상자</th>
              <th scope="col" className={`${thClass} text-right`}>누적 비용</th>
              <th scope="col" className={`${thClass} text-right`}>추가 비용</th>
              <th scope="col" className={`${thClass} text-right`}>추가 보상</th>
              <th scope="col" className={`${thClass} text-right`}>보상/만원</th>
            </tr>
          </thead>
          <tbody>
            {table.map((r) => (
              <tr key={r.boxes} className="border-t border-border">
                <th scope="row" className="px-3 py-2 text-left font-bold whitespace-nowrap">
                  {fmt(r.boxes)}상자
                  {r.milestones.length > 1 ? (
                    <span className="ml-1 text-xs font-normal text-muted">({r.milestones.join('·')} 포함)</span>
                  ) : null}
                </th>
                <td className={tdNum}>{won(r.cumulativeCost)}</td>
                <td className={tdNum}>{won(r.marginalCost)}</td>
                <td className={tdNum}>+{fmt(r.marginalReward)}</td>
                <td className={tdNum}>
                  {Number.isFinite(r.rewardPerManwon) ? r.rewardPerManwon.toFixed(1) : '∞'}{' '}
                  <span className={`text-xs font-bold ${MARGINAL_LABEL[r.grade].cls}`}>{MARGINAL_LABEL[r.grade].label}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted">등급: 최고 35 이상 · 좋음 28 · 보통 24 · 비효율 그 미만 (보상 개수/만원)</p>

      <h3 className="mt-6 font-bold">목표 상자</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {WIND_TARGETS.map((t) => (
          <button key={String(t)} type="button" onClick={() => setTarget(t)} className={chipClass(t === target)}>
            {t === 'max' ? '최대' : `${fmt(t)}상자`}
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-border bg-raised p-4" aria-live="polite">
        <p className="text-sm text-muted">
          {target === 'max' ? '전부 구매' : `${fmt(target)}상자 목표`} 총 비용
          {!plan.reached ? <span className="ml-2 font-bold text-danger">달성 불가</span> : null}
        </p>
        <p className="mt-1 text-2xl font-extrabold tabular-nums text-accent-strong sm:text-3xl">{won(plan.totalCost)}</p>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-muted">상자 · 시간</dt>
            <dd className="font-bold tabular-nums">
              {fmt(plan.boxes)}상자 · {fmt(plan.totalHours)}h
            </dd>
          </div>
          <div>
            <dt className="text-muted">달성보상</dt>
            <dd className="font-bold tabular-nums">
              {fmt(plan.achievementReward)}개 <span className="font-normal text-muted">({won(plan.achievementReward * price)})</span>
            </dd>
          </div>
          <div>
            <dt className="text-muted">상자 가치 (합성 안 함 → 풀합성)</dt>
            <dd className="font-bold tabular-nums">
              {fmt(Math.round(plan.contentNoSynth))} → {fmt(Math.round(plan.contentFullSynth))}개
            </dd>
          </div>
          <div>
            <dt className="text-muted">총 가치 ({itemName})</dt>
            <dd className="font-bold tabular-nums">{won(valueKRW)}</dd>
          </div>
          <div>
            <dt className="text-muted">순이익 (가치 − 비용)</dt>
            <dd className={`font-bold tabular-nums ${net >= 0 ? 'text-success' : 'text-danger'}`}>
              {net >= 0 ? '+' : '−'}
              {won(Math.abs(net))}
            </dd>
          </div>
          <div>
            <dt className="text-muted">가치 / 비용</dt>
            <dd className="font-bold tabular-nums">
              {plan.totalCost > 0 ? `${(valueKRW / plan.totalCost).toFixed(2)}×` : '∞'}
            </dd>
          </div>
        </dl>
        {plan.overshoot > 0 ? (
          <p className="mt-2 text-xs text-muted">
            목표보다 {fmt(plan.overshoot)}상자 더 나옵니다. 넘친 상자는 달성보상엔 안 들어가고 내용물 가치만 더해집니다.
          </p>
        ) : null}
        <ul className="mt-3 flex flex-wrap gap-2 text-sm">
          {plan.useSlot ? <li className="rounded-lg border border-border bg-bg px-2.5 py-1">슬롯 증설 ×1</li> : null}
          {WIND_PACKAGES.map((p, i) =>
            plan.counts[i] > 0 ? (
              <li key={p.price} className="rounded-lg border border-border bg-bg px-2.5 py-1 tabular-nums">
                {won(p.price)} ×{plan.counts[i]} (+{fmt(p.hours * plan.counts[i])}h)
              </li>
            ) : null,
          )}
        </ul>
      </div>
      <p className="mt-3 text-xs text-muted">
        상자 확률은 일반 90% · 고급 10%, 가치는 일반 4 · 고급 12 · 정교 24 · 탁월 80입니다. 일반 3개 → 고급 1개는
        가치가 같고, 고급 3개 → 정교 75% / 탁월 25%는 기대값 38로 36보다 이득이라 끝까지 합성하면 상자당 기대
        가치가 {EV_NO_SYNTH.toFixed(1)} → {EV_FULL_SYNTH.toFixed(2)}로 오릅니다.
      </p>
    </div>
  );
}

export default function PackValueCalculator() {
  const [tab, setTab] = useState<Tab>('ranking');

  return (
    <div className="rounded-xl border border-border bg-surface/60 p-4 sm:p-5">
      <div role="tablist" aria-label="계산기 종류" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`pv-tab-${t.key}`}
            aria-selected={t.key === tab}
            aria-controls="pv-panel"
            onClick={() => setTab(t.key)}
            className={chipClass(t.key === tab)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div id="pv-panel" role="tabpanel" aria-labelledby={`pv-tab-${tab}`} className="mt-5 border-t border-border pt-5">
        {tab === 'ranking' ? <RankingPanel /> : tab === 'tokens' ? <TokenPanel /> : <WindPanel />}
      </div>
    </div>
  );
}
