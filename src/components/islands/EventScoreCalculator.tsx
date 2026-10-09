import { useMemo, useState } from 'react';
import {
  INPUT_ITEM_IDS,
  SCORE_EVENTS,
  SCORE_ITEMS,
  compareEvents,
  type EventId,
  type EventPlan,
  type Inventory,
  type ScoreItemId,
  type TroopOptions,
} from '@/data/event-score';

/**
 * 이벤트 점수 계산기. 보유 아이템과 병력 훈련 조건으로 KvK·지고의 영주 예상 총점을 비교하고,
 * 고른 이벤트의 일자별 배분을 보여준다. 계산은 src/data/event-score.ts 순수 함수를 그대로 쓴다.
 */

const TIERS = Array.from({ length: 11 }, (_, i) => 11 - i);

function toSafeNumber(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString('ko-KR');
}

function itemLabel(id: ScoreItemId): string {
  return SCORE_ITEMS[id].name;
}

export default function EventScoreCalculator() {
  const [raw, setRaw] = useState<Partial<Record<ScoreItemId, string>>>({});
  const [mode, setMode] = useState<TroopOptions['mode']>('training');
  const [tier, setTier] = useState(11);
  const [fromTier, setFromTier] = useState(10);
  const [availableRaw, setAvailableRaw] = useState('');
  const [speedRaw, setSpeedRaw] = useState('');
  const [picked, setPicked] = useState<EventId | null>(null);

  const inventory = useMemo<Inventory>(() => {
    const inv: Partial<Record<ScoreItemId, number>> = {};
    for (const id of INPUT_ITEM_IDS) inv[id] = toSafeNumber(raw[id] ?? '');
    return inv;
  }, [raw]);

  const options: TroopOptions = {
    mode,
    tier,
    fromTier,
    availableTroops: toSafeNumber(availableRaw),
    trainSpeedPercent: toSafeNumber(speedRaw),
  };
  const { plans, margin } = useMemo(
    () => compareEvents(inventory, options),
    // options 는 매 렌더 새 객체라 원시값으로 의존성을 건다.
    [inventory, mode, tier, fromTier, availableRaw, speedRaw],
  );
  const hasInput = INPUT_ITEM_IDS.some((id) => (inventory[id] ?? 0) > 0);
  const best = plans[0];
  const selected = plans.find((p) => p.event.id === picked) ?? best;
  const tied = plans.length > 1 && margin === 0;

  const fieldClass =
    'w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-muted';
  const labelClass = 'mb-1.5 block text-sm font-semibold text-muted';

  function changeMode(next: TroopOptions['mode']) {
    setMode(next);
    if (next === 'promotion' && tier <= fromTier) setTier(Math.min(11, fromTier + 1));
  }

  function changeFromTier(next: number) {
    setFromTier(next);
    if (tier <= next) setTier(Math.min(11, next + 1));
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-surface/60 p-4 sm:p-5">
        <h2 className="text-lg font-bold">보유 아이템</h2>
        <p className="mt-1 text-sm text-muted">
          인벤토리 수량을 그대로 넣으세요. 가속은 분 단위입니다.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {INPUT_ITEM_IDS.map((id) => (
            <div key={id}>
              <label className={labelClass} htmlFor={`evs-${id}`}>
                {itemLabel(id)} ({SCORE_ITEMS[id].unit})
              </label>
              <input
                id={`evs-${id}`}
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={raw[id] ?? ''}
                onChange={(e) => {
                  const v = e.currentTarget.value;
                  setRaw((prev) => ({ ...prev, [id]: v }));
                }}
                placeholder="0"
                className={`${fieldClass} tabular-nums`}
              />
            </div>
          ))}
        </div>

        <h3 className="mt-6 font-bold">병력 훈련 조건</h3>
        <p className="mt-1 text-sm text-muted">
          훈련 가속은 그대로 쓰는 것보다 병력을 뽑는 쪽이 점수가 높을 수 있습니다. 둘 중 높은 쪽을
          자동으로 고릅니다.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="evs-mode">
              방식
            </label>
            <select
              id="evs-mode"
              value={mode}
              onChange={(e) => changeMode(e.currentTarget.value as TroopOptions['mode'])}
              className={fieldClass}
            >
              <option value="training">훈련 (새로 뽑기)</option>
              <option value="promotion">승급 (기존 병력 올리기)</option>
            </select>
          </div>

          {mode === 'promotion' ? (
            <>
              <div>
                <label className={labelClass} htmlFor="evs-from">
                  승급 출발 티어
                </label>
                <select
                  id="evs-from"
                  value={fromTier}
                  onChange={(e) => changeFromTier(Number(e.currentTarget.value))}
                  className={fieldClass}
                >
                  {TIERS.filter((t) => t <= 10).map((t) => (
                    <option key={t} value={t}>
                      T{t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="evs-available">
                  올릴 보유 병력 (명, 비우면 가속 상한까지)
                </label>
                <input
                  id="evs-available"
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  value={availableRaw}
                  onChange={(e) => setAvailableRaw(e.currentTarget.value)}
                  placeholder="0"
                  className={`${fieldClass} tabular-nums`}
                />
              </div>
            </>
          ) : null}

          <div>
            <label className={labelClass} htmlFor="evs-tier">
              {mode === 'promotion' ? '승급 목표 티어' : '훈련할 병력 티어'}
            </label>
            <select
              id="evs-tier"
              value={tier}
              onChange={(e) => setTier(Number(e.currentTarget.value))}
              className={fieldClass}
            >
              {TIERS.filter((t) => mode === 'training' || t > fromTier).map((t) => (
                <option key={t} value={t}>
                  T{t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass} htmlFor="evs-speed">
              훈련 속도 보너스 %
            </label>
            <input
              id="evs-speed"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={speedRaw}
              onChange={(e) => setSpeedRaw(e.currentTarget.value)}
              placeholder="0"
              className={`${fieldClass} tabular-nums`}
            />
          </div>
        </div>
      </div>

      {hasInput ? (
        <>
          <section className="rounded-xl border border-border bg-surface/60 p-4 sm:p-5">
            <h2 className="text-lg font-bold">어떤 이벤트에 쓸까</h2>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {plans.map((p, i) => {
                const isSelected = p.event.id === selected.event.id;
                const troop = p.route?.chosen === 'train' ? p.route.trainScore : 0;
                return (
                  <button
                    key={p.event.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setPicked(p.event.id)}
                    className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                      isSelected ? 'border-accent bg-accent/10' : 'border-border bg-bg hover:border-accent/50'
                    }`}
                  >
                    <span className="flex items-center gap-2 font-bold">
                      {p.event.name}
                      {i === 0 && !tied ? (
                        <span className="rounded-full border border-accent/60 px-2 py-0.5 text-xs text-accent-strong">
                          유리
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1 block text-2xl font-extrabold tabular-nums text-accent-strong">
                      {fmt(p.totalScore)}점
                    </span>
                    <span className="mt-1 block text-xs text-muted">
                      점수 나는 아이템 {p.itemPlans.length}종
                      {troop > 0 ? ` · 병력 훈련 ${fmt(troop)}점` : ''}
                      {i === 0 && !tied ? ` · 2위와 ${fmt(margin)}점 차이` : ''}
                    </span>
                  </button>
                );
              })}
            </div>
            {tied ? (
              <p className="mt-3 text-sm text-muted">
                보유 아이템 배점은 두 이벤트가 같아서 아이템만으로는 점수가 같습니다. 차이는 훈련
                가속을 병력에 쓸 때 생깁니다(10급 기준 KvK 60점/명, 지고의 영주 39점/명).
              </p>
            ) : null}
            {plans.some((p) => p.event.id === 'kvk') ? (
              <p className="mt-2 text-xs text-warning">
                KvK는 확인된 1~5일차 항목만 반영돼 있어 실제보다 낮게 나올 수 있습니다.
              </p>
            ) : null}
          </section>

          <PlanDetail plan={selected} />
        </>
      ) : (
        <p className="rounded-xl border border-border bg-surface/60 px-4 py-6 text-center text-sm text-muted">
          보유 아이템 수량을 넣으면 이벤트별 예상 총점이 나옵니다.
        </p>
      )}
    </div>
  );
}

function PlanDetail({ plan }: { plan: EventPlan }) {
  const route = plan.route;
  const usedStages = plan.stages.filter((s) => s.items.length > 0);

  return (
    <section className="rounded-xl border border-border bg-surface/60 p-4 sm:p-5">
      <h2 className="text-lg font-bold">{plan.event.name} 일자별 배분</h2>

      {route ? (
        <div className="mt-3 rounded-lg border border-border bg-bg px-3 py-3 text-sm">
          <p>
            <span className="font-bold">
              훈련 가속 사용처: {route.chosen === 'train' ? '병력 훈련' : '가속으로 사용'}
            </span>{' '}
            {fmt(route.chosen === 'train' ? route.trainScore : route.burnScore)}점
            <span className="text-muted">
              {' '}
              (다른 선택지 {fmt(route.chosen === 'train' ? route.burnScore : route.trainScore)}점)
            </span>
          </p>
          {route.chosen === 'train' ? (
            <ul className="mt-1 space-y-0.5 text-xs text-muted">
              <li>
                훈련 병력 {fmt(route.troops)}명 · 전투력 +{fmt(route.powerGain)} · 가속으로 가능{' '}
                {fmt(route.troopsBySpeedup)}명
                {route.availableTroops !== null ? ` · 보유 ${fmt(route.availableTroops)}명` : ''}
              </li>
              {route.leftoverMinutes > 0 ? (
                <li>
                  남는 가속 {fmt(route.leftoverMinutes)}분 →{' '}
                  {route.leftoverUse === 'train'
                    ? `신규 훈련 ${fmt(route.leftoverTroops)}명`
                    : '가속으로 사용'}{' '}
                  ({fmt(route.leftoverScore)}점)
                </li>
              ) : null}
            </ul>
          ) : null}
        </div>
      ) : null}

      {usedStages.length > 0 ? (
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-bg">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">{plan.event.name} 일자별 아이템 배분</caption>
            <thead>
              <tr className="bg-raised text-left">
                <th scope="col" className="px-4 py-3 font-bold whitespace-nowrap">
                  일자
                </th>
                <th scope="col" className="px-4 py-3 font-bold">
                  투입 아이템
                </th>
                <th scope="col" className="px-4 py-3 text-right font-bold whitespace-nowrap">
                  소계
                </th>
              </tr>
            </thead>
            <tbody>
              {usedStages.map(({ stage, items, subtotal }) => (
                <tr key={stage.day} className="border-t border-border align-top">
                  <th scope="row" className="px-4 py-3 text-left font-bold whitespace-nowrap">
                    {stage.day}. {stage.name}
                  </th>
                  <td className="px-4 py-3">
                    {items.map((p) => (
                      <div key={p.id} className="tabular-nums">
                        {itemLabel(p.id)} {fmt(p.quantity)}
                        {SCORE_ITEMS[p.id].unit} × {fmt(p.pointsPerUnit)} ={' '}
                        <span className="font-semibold">{fmt(p.score)}</span>
                        {p.tiedDays.length > 0 ? (
                          <span className="text-xs text-muted">
                            {' '}
                            (같은 점수: {p.tiedDays.join(', ')}일차)
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums whitespace-nowrap">
                    {fmt(subtotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {plan.unusedItems.length > 0 ? (
        <p className="mt-3 text-sm text-muted">
          이 이벤트에서 점수가 없는 입력:{' '}
          {plan.unusedItems
            .map((u) => `${itemLabel(u.id)} ${fmt(u.quantity)}${SCORE_ITEMS[u.id].unit}`)
            .join(' / ')}
        </p>
      ) : null}
    </section>
  );
}

/** 이벤트별 아이템 x 일자 배점표. 페이지에서 정적으로 렌더한다. */
export function ScoreMatrix() {
  return (
    <div className="space-y-6">
      {SCORE_EVENTS.map((event) => (
        <div key={event.id}>
          <h3 className="font-bold">{event.name}</h3>
          <div className="mt-2 overflow-x-auto rounded-xl border border-border bg-bg">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">{event.name} 아이템별 일자 배점</caption>
              <thead>
                <tr className="bg-raised text-left">
                  <th scope="col" className="px-3 py-2 font-bold whitespace-nowrap">
                    항목 (단위)
                  </th>
                  {event.stages.map((s) => (
                    <th
                      key={s.day}
                      scope="col"
                      className="px-3 py-2 text-right font-bold whitespace-nowrap"
                      title={s.name}
                    >
                      {s.day}일차
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {event.items.map((id) => (
                  <tr key={id} className="border-t border-border">
                    <th scope="row" className="px-3 py-2 text-left font-semibold whitespace-nowrap">
                      {itemLabel(id)} <span className="font-normal text-muted">({SCORE_ITEMS[id].unit})</span>
                    </th>
                    {event.stages.map((s) => {
                      const r = s.rates[id];
                      return (
                        <td key={s.day} className="px-3 py-2 text-right tabular-nums">
                          {r ? fmt(r) : <span className="text-muted">-</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
