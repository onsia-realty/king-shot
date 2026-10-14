import { useCalculatorLocale } from '@/lib/calculator-locale';
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
  const { t: ui, text: tx } = useCalculatorLocale();
  const ranked = useMemo(() => rankEventPackages(), []);
  return (
    <div>
      <p className="text-sm text-muted">{ui("순금 4/5세대 기준 패키지(7,500원) 단가로 구성품을 원화 환산해 더한 뒤 가격으로 나눴습니다. 효율 100% = 기준 패키지와 같은 값어치입니다. 등급: S 150% 이상 · A 120% · B 100% · C 80% · D 그 미만.", "Contents are valued in KRW using the Truegold 4/5 reference package (₩7,500), then divided by price. 100% equals the reference value. Grades: S ≥150% · A ≥120% · B ≥100% · C ≥80% · D below 80%.")}</p>
      <ol className="mt-4 space-y-3">
        {ranked.map((r) => (
          <li key={r.pkg.id} className="rounded-xl border border-border bg-bg">
            <details>
              <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                <span className="font-extrabold tabular-nums text-muted">{r.rank}{ui("위", " place")}</span>
                <span className="font-bold">
                  {tx(r.pkg.eventName)} {tx(r.pkg.packageName)}
                  {r.pkg.maxPurchases !== null ? (
                    <span className="ml-1 text-xs text-muted">({r.pkg.maxPurchases}{ui("회 한정)", " purchases max)")}</span>
                  ) : null}
                </span>
                <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${GRADE_CLASS[r.grade]}`}>
                  {tx(r.grade)}
                </span>
                <span className="ml-auto text-right text-sm tabular-nums">{ui("효율 ", "Value ratio ")}<strong className="text-accent-strong">{Math.round(r.ratio * 100)}%</strong>
                  <span className="text-muted">{ui(" · 가치 ", " · Value ")}{tx(won(r.totalValueKRW))}</span>
                </span>
              </summary>
              <div className="overflow-x-auto border-t border-border">
                <table className="w-full border-collapse text-sm">
                  <caption className="sr-only">{tx(r.pkg.packageName)}{ui(" 구성품별 환산가", " estimated value by item")}</caption>
                  <thead>
                    <tr className="bg-raised text-left">
                      <th scope="col" className={thClass}>{ui("구성품", "Contents")}</th>
                      <th scope="col" className={`${thClass} text-right`}>{ui("수량", "Quantity")}</th>
                      <th scope="col" className={`${thClass} text-right`}>{ui("개당 단가", "Unit price")}</th>
                      <th scope="col" className={`${thClass} text-right`}>{ui("환산가", "Estimated value")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.items.map((i, idx) => (
                      <tr key={idx} className="border-t border-border">
                        <th scope="row" className="px-3 py-2 text-left font-semibold">{tx(i.name)}</th>
                        <td className={tdNum}>{fmt(i.amount)}</td>
                        <td className={tdNum}>{fmt(i.unitPriceKRW)}{ui("원", " KRW")}</td>
                        <td className={tdNum}>{tx(won(i.valueKRW))}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-border bg-raised">
                      <th scope="row" className="px-3 py-2 text-left font-bold">{ui("합계 / 가격", "Total value / price")}</th>
                      <td className={tdNum} colSpan={2}>{ui("이벤트 토큰 ", "Event tokens ")}{fmt(r.pkg.tokens)}
                      </td>
                      <td className={`${tdNum} font-bold`}>
                        {tx(won(r.totalValueKRW))} / {tx(won(r.pkg.priceKRW))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </details>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-muted">{ui("가속은 7,500원 = 119시간으로 환산합니다. 특별아이템은 망치 개수로 환산해 망치 단가를 매깁니다.", "Speedups are valued at ₩7,500 per 119 hours. Special items use their hammer equivalent and hammer unit price.")}</p>
    </div>
  );
}

/* ───────── 2. 토큰 최적화 ───────── */

function TokenPanel() {
  const { t: ui, text: tx } = useCalculatorLocale();
  const [targetRaw, setTargetRaw] = useState('1000');
  const [scenarioIdx, setScenarioIdx] = useState(0);

  const target = Math.max(0, Math.floor(Number(targetRaw) || 0));
  const plan = useMemo(() => optimizeTokens(target), [target]);
  const set = TOKEN_SCENARIOS[scenarioIdx];

  return (
    <div>
      <p className="text-sm text-muted">{ui("목표 진행 토큰을 넣으면 일반 패키지 7종(각 5회)과 일일퀘스트 2배권(", "Enter a progress-token target to find the cheapest combination of seven packages (up to five each) and the daily quest doubler (")}{tx(won(DAILY_DOUBLE.price))}, +
        {DAILY_DOUBLE.tokens}{ui(") 조합을 전부 따져 가장 싼 조합을 찾습니다. 무료 토큰 ", "). All combinations are checked. Includes ")}{FREE_TOKENS}{ui("개(기본 40 + 일일퀘스트 100)는 자동으로 포함합니다.", " free tokens (40 base + 100 daily quests).")}</p>

      <div className="mt-4">
        <label className={labelClass} htmlFor="pv-token-target">{ui("목표 진행 토큰", "Target progress tokens")}</label>
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
          <p className="text-sm text-danger">{ui("모든 패키지를 최대로 사도 ", "Buying every available package cannot reach ")}{fmt(target)}{ui("토큰에 닿지 않습니다. 최대 진행 토큰은 10,040입니다.", " tokens. Maximum progress tokens: 10,040.")}</p>
        ) : (
          <>
            <p className="text-sm text-muted">{fmt(target)}{ui("토큰 최소 비용", " tokens · minimum cost")}</p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums text-accent-strong sm:text-3xl">
              {tx(plan.totalCost === 0 ? '무료' : won(plan.totalCost))}
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-muted">{ui("진행 토큰", "Progress tokens")}</dt>
                <dd className="font-bold tabular-nums">{fmt(plan.progressTokens)}</dd>
              </div>
              <div>
                <dt className="text-muted">{ui("마일스톤 보너스", "Milestone bonus")}</dt>
                <dd className="font-bold tabular-nums">+{fmt(plan.bonusTokens)}</dd>
              </div>
              <div>
                <dt className="text-muted">{ui("최종 토큰", "Final tokens")}</dt>
                <dd className="font-bold tabular-nums">{fmt(plan.finalTokens)}</dd>
              </div>
              <div>
                <dt className="text-muted">{ui("토큰당 (최종 기준)", "Cost per final token")}</dt>
                <dd className="font-bold tabular-nums">
                  {tx(plan.totalCost > 0 ? `${fmt(plan.totalCost / plan.finalTokens)}원` : '-')}
                </dd>
              </div>
            </dl>
            {plan.totalCost > 0 ? (
              <ul className="mt-3 flex flex-wrap gap-2 text-sm">
                {plan.useDouble ? (
                  <li className="rounded-lg border border-border bg-bg px-2.5 py-1">{ui("2배권 ×1", "Quest doubler ×1")}</li>
                ) : null}
                {TOKEN_PACKAGES.map((p, i) =>
                  plan.counts[i] > 0 ? (
                    <li key={p.price} className="rounded-lg border border-border bg-bg px-2.5 py-1 tabular-nums">
                      {tx(won(p.price))} ×{plan.counts[i]}
                    </li>
                  ) : null,
                )}
              </ul>
            ) : null}
          </>
        )}
      </div>

      <h3 className="mt-8 font-bold">{ui("목표별 시나리오 비교", "Compare target scenarios")}</h3>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={ui("시나리오 목표", "Scenario target")}>
        {TOKEN_SCENARIOS.map((s, i) => (
          <button key={s.target} type="button" onClick={() => setScenarioIdx(i)} className={chipClass(i === scenarioIdx)}>
            {fmt(s.target)}
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm text-muted">{tx(set.summary)}</p>
      <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-bg">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{fmt(set.target)}{ui("토큰 시나리오 비교 (모두 2배권 포함)", " token scenarios (all include quest doubler)")}</caption>
          <thead>
            <tr className="bg-raised text-left">
              <th scope="col" className={thClass}>{ui("시나리오", "Scenario")}</th>
              <th scope="col" className={thClass}>{ui("구성 (2배권 포함)", "Contents (includes doubler)")}</th>
              <th scope="col" className={`${thClass} text-right`}>{ui("총 비용", "Total cost")}</th>
              <th scope="col" className={`${thClass} text-right`}>{ui("진행 / 최종", "Progress / final")}</th>
              <th scope="col" className={`${thClass} text-right`}>{ui("최종 토큰당", "Per final token")}</th>
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
                    <span className={`font-bold ${tone}`}>{tx(sc.name)}</span>
                    <span className="mt-0.5 block text-xs font-normal text-muted">{tx(sc.note)}</span>
                  </th>
                  <td className="px-3 py-2 text-xs text-muted">
                    {tx(TOKEN_PACKAGES.map((pk, i) => (sc.counts[i] > 0 ? `${fmt(pk.price)}×${sc.counts[i]}` : null))
                      .filter(Boolean)
                      .join(' + '))}
                  </td>
                  <td className={tdNum}>{tx(won(p.totalCost))}</td>
                  <td className={tdNum}>
                    {fmt(p.progressTokens)} / {fmt(p.finalTokens)}
                  </td>
                  <td className={tdNum}>{fmt(p.totalCost / p.finalTokens)}{ui("원", " KRW")}</td>
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
  const { t: ui, text: tx } = useCalculatorLocale();
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
      <p className="text-sm text-muted">{ui("패키지는 가속(시간)만 주고 ", "Packages provide speedup hours, with one box per ")}{8}{ui("시간당 상자 1개라서, 시간당 싼 패키지부터 5회씩 채우는 게 항상 최소 비용입니다(", " hours. Buying up to five of each package from cheapest per hour gives the minimum cost (")}{tx(WIND_PACKAGES.map((p) => fmt(p.price)).join(' → '))}{ui("원). 달성보상은 누적이라 마일스톤마다 추가 비용 대비 추가 보상(한계효용)이 다릅니다.", " KRW). Milestone rewards accumulate, so marginal reward per additional cost varies.")}</p>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <span className={labelClass}>{ui("가치 기준 아이템", "Item used for valuation")}</span>
          <div className="flex gap-2">
            {(['blueprint', 'sketch'] as const).map((k) => (
              <button key={k} type="button" onClick={() => setItem(k)} className={chipClass(item === k)}>
                {tx(k === 'blueprint' ? '보석 도면' : '스케치')}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className={labelClass} htmlFor="pv-wind-stage">{ui("세대 (개당 ", "Generation (unit price: ")}{fmt(price)}{ui("원)", " KRW)")}</label>
          <select
            id="pv-wind-stage"
            value={stage}
            onChange={(e) => setStage(e.currentTarget.value as PackageGeneration)}
            className={fieldClass}
          >
            {PACKAGE_GENERATIONS.map((g) => (
              <option key={g.key} value={g.key}>
                {tx(g.name)}
                {tx(g.predicted ? ' (예측)' : '')}
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
            <span className="font-semibold">{ui("슬롯 증설 패키지 사용", "Include slot expansion package")}</span>
            <span className="block text-xs text-muted">
              {tx(won(SLOT_PACKAGE.price))}{ui("에 상자 ", " provides ")}{SLOT_PACKAGE.freeBoxes}{ui("개 무료 (5일, 8시간 간격)", " free boxes (5 days, every 8 hours)")}</span>
          </span>
        </label>
      </div>

      <h3 className="mt-6 font-bold">{ui("마일스톤 한계효용", "Milestone marginal value")}</h3>
      <div className="mt-2 overflow-x-auto rounded-xl border border-border bg-bg">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{ui("마일스톤별 추가 비용과 추가 보상", "Additional cost and reward by milestone")}</caption>
          <thead>
            <tr className="bg-raised text-left">
              <th scope="col" className={thClass}>{ui("도달 상자", "Boxes reached")}</th>
              <th scope="col" className={`${thClass} text-right`}>{ui("누적 비용", "Cumulative cost")}</th>
              <th scope="col" className={`${thClass} text-right`}>{ui("추가 비용", "Additional cost")}</th>
              <th scope="col" className={`${thClass} text-right`}>{ui("추가 보상", "Additional reward")}</th>
              <th scope="col" className={`${thClass} text-right`}>{ui("보상/만원", "Rewards / ₩10,000")}</th>
            </tr>
          </thead>
          <tbody>
            {table.map((r) => (
              <tr key={r.boxes} className="border-t border-border">
                <th scope="row" className="px-3 py-2 text-left font-bold whitespace-nowrap">
                  {fmt(r.boxes)}{ui("상자", " boxes")}{r.milestones.length > 1 ? (
                    <span className="ml-1 text-xs font-normal text-muted">({tx(r.milestones.join('·'))}{ui(" 포함)", "  included)")}</span>
                  ) : null}
                </th>
                <td className={tdNum}>{tx(won(r.cumulativeCost))}</td>
                <td className={tdNum}>{tx(won(r.marginalCost))}</td>
                <td className={tdNum}>+{fmt(r.marginalReward)}</td>
                <td className={tdNum}>
                  {Number.isFinite(r.rewardPerManwon) ? r.rewardPerManwon.toFixed(1) : '∞'}{' '}
                  <span className={`text-xs font-bold ${MARGINAL_LABEL[r.grade].cls}`}>{tx(MARGINAL_LABEL[r.grade].label)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted">{ui("등급: 최고 35 이상 · 좋음 28 · 보통 24 · 비효율 그 미만 (보상 개수/만원)", "Grades: Best ≥35 · Good ≥28 · Fair ≥24 · Poor below 24 (rewards per ₩10,000)")}</p>

      <h3 className="mt-6 font-bold">{ui("목표 상자", "Target boxes")}</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {WIND_TARGETS.map((t) => (
          <button key={String(t)} type="button" onClick={() => setTarget(t)} className={chipClass(t === target)}>
            {tx(t === 'max' ? '최대' : `${fmt(t)}상자`)}
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-border bg-raised p-4" aria-live="polite">
        <p className="text-sm text-muted">
          {tx(target === 'max' ? '전부 구매' : `${fmt(target)}상자 목표`)}{ui(" 총 비용", " Total cost")}{!plan.reached ? <span className="ml-2 font-bold text-danger">{ui("달성 불가", "Unreachable")}</span> : null}
        </p>
        <p className="mt-1 text-2xl font-extrabold tabular-nums text-accent-strong sm:text-3xl">{tx(won(plan.totalCost))}</p>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-muted">{ui("상자 · 시간", "Boxes · hours")}</dt>
            <dd className="font-bold tabular-nums">
              {fmt(plan.boxes)}{ui("상자 · ", " boxes · ")}{fmt(plan.totalHours)}h
            </dd>
          </div>
          <div>
            <dt className="text-muted">{ui("달성보상", "Milestone rewards")}</dt>
            <dd className="font-bold tabular-nums">
              {fmt(plan.achievementReward)}{ui("개 ", " items ")}<span className="font-normal text-muted">({tx(won(plan.achievementReward * price))})</span>
            </dd>
          </div>
          <div>
            <dt className="text-muted">{ui("상자 가치 (합성 안 함 → 풀합성)", "Box value (no merging → full merging)")}</dt>
            <dd className="font-bold tabular-nums">
              {fmt(Math.round(plan.contentNoSynth))} → {fmt(Math.round(plan.contentFullSynth))}{ui("개", " items")}</dd>
          </div>
          <div>
            <dt className="text-muted">{ui("총 가치 (", "Total value (")}{tx(itemName)})</dt>
            <dd className="font-bold tabular-nums">{tx(won(valueKRW))}</dd>
          </div>
          <div>
            <dt className="text-muted">{ui("순이익 (가치 − 비용)", "Net value (value − cost)")}</dt>
            <dd className={`font-bold tabular-nums ${net >= 0 ? 'text-success' : 'text-danger'}`}>
              {tx(net >= 0 ? '+' : '−')}
              {tx(won(Math.abs(net)))}
            </dd>
          </div>
          <div>
            <dt className="text-muted">{ui("가치 / 비용", "Value / cost")}</dt>
            <dd className="font-bold tabular-nums">
              {plan.totalCost > 0 ? `${(valueKRW / plan.totalCost).toFixed(2)}×` : '∞'}
            </dd>
          </div>
        </dl>
        {plan.overshoot > 0 ? (
          <p className="mt-2 text-xs text-muted">{ui("목표보다 ", "Exceeds target by ")}{fmt(plan.overshoot)}{ui("상자 더 나옵니다. 넘친 상자는 달성보상엔 안 들어가고 내용물 가치만 더해집니다.", " boxes. Extra boxes add only their contents value, not milestone rewards.")}</p>
        ) : null}
        <ul className="mt-3 flex flex-wrap gap-2 text-sm">
          {plan.useSlot ? <li className="rounded-lg border border-border bg-bg px-2.5 py-1">{ui("슬롯 증설 ×1", "Slot expansion ×1")}</li> : null}
          {WIND_PACKAGES.map((p, i) =>
            plan.counts[i] > 0 ? (
              <li key={p.price} className="rounded-lg border border-border bg-bg px-2.5 py-1 tabular-nums">
                {tx(won(p.price))} ×{plan.counts[i]} (+{fmt(p.hours * plan.counts[i])}h)
              </li>
            ) : null,
          )}
        </ul>
      </div>
      <p className="mt-3 text-xs text-muted">{ui("상자 확률은 일반 90% · 고급 10%, 가치는 일반 4 · 고급 12 · 정교 24 · 탁월 80입니다. 일반 3개 → 고급 1개는 가치가 같고, 고급 3개 → 정교 75% / 탁월 25%는 기대값 38로 36보다 이득이라 끝까지 합성하면 상자당 기대 가치가 ", "Box odds: Common 90%, Uncommon 10%. Values: Common 4, Uncommon 12, Refined 24, Excellent 80. Merging 3 Common into 1 Uncommon preserves value. Merging 3 Uncommon yields Refined (75%) or Excellent (25%), with expected value 38 versus 36. Full merging raises expected value per box from ")}{EV_NO_SYNTH.toFixed(1)} → {EV_FULL_SYNTH.toFixed(2)}{ui("로 오릅니다.", ".")}</p>
    </div>
  );
}

export default function PackValueCalculator() {
  const { t: ui, text: tx } = useCalculatorLocale();
  const [tab, setTab] = useState<Tab>('ranking');

  return (
    <div className="rounded-xl border border-border bg-surface/60 p-4 sm:p-5">
      <div role="tablist" aria-label={ui("계산기 종류", "Calculator type")} className="flex flex-wrap gap-2">
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
            {tx(t.label)}
          </button>
        ))}
      </div>
      <div id="pv-panel" role="tabpanel" aria-labelledby={`pv-tab-${tab}`} className="mt-5 border-t border-border pt-5">
        {tab === 'ranking' ? <RankingPanel /> : tab === 'tokens' ? <TokenPanel /> : <WindPanel />}
      </div>
    </div>
  );
}
