import { useMemo, useState } from 'react';
import {
  HERO_SHARD_ROWS,
  HERO_SHARD_STARS,
  type HeroShardTier,
} from '@/data/hero-shard';

/**
 * 영웅 승급 파편 계산기.
 *
 * 데이터는 src/data/hero-shard.ts 의 공통 표를 그대로 쓴다.
 * counts[i] 는 "(i+1)성으로 올리는 데 드는 파편 수"라서,
 * 현재 성급 다음 단계부터 목표 성급까지 더하면 총 소요량이 나온다.
 */

const TIERS = HERO_SHARD_ROWS.map((row) => row.tier);
const CURRENT_STARS = [0, ...HERO_SHARD_STARS];
const TARGET_STARS = HERO_SHARD_STARS;

function toSafeInt(raw: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function fmt(n: number): string {
  return n.toLocaleString('ko-KR');
}

interface Step {
  /** 올라가는 목표 성급 */
  star: number;
  cost: number;
  cumulative: number;
}

export default function HeroAscensionCalculator() {
  const [tier, setTier] = useState<HeroShardTier>('T6');
  const [current, setCurrent] = useState(0);
  const [target, setTarget] = useState(5);
  const [ownedRaw, setOwnedRaw] = useState('');

  const counts = useMemo(
    () => HERO_SHARD_ROWS.find((row) => row.tier === tier)?.counts ?? HERO_SHARD_ROWS[0].counts,
    [tier],
  );

  const owned = toSafeInt(ownedRaw);
  const invalid = target <= current;

  const steps = useMemo<Step[]>(() => {
    if (invalid) return [];
    const list: Step[] = [];
    let sum = 0;
    for (let star = current + 1; star <= target; star += 1) {
      const cost = counts[star - 1] ?? 0;
      sum += cost;
      list.push({ star, cost, cumulative: sum });
    }
    return list;
  }, [counts, current, target, invalid]);

  const total = steps.length > 0 ? steps[steps.length - 1].cumulative : 0;
  const missing = Math.max(0, total - owned);
  const enough = !invalid && missing === 0;

  const fieldClass =
    'w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-muted';
  const labelClass = 'mb-1.5 block text-sm font-semibold text-muted';

  return (
    <div className="rounded-xl border border-border bg-surface/60 p-4 sm:p-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="asc-tier">
            영웅 등급
          </label>
          <select
            id="asc-tier"
            value={tier}
            onChange={(e) => setTier(e.currentTarget.value as HeroShardTier)}
            className={fieldClass}
          >
            {TIERS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="asc-owned">
            보유 파편 (선택)
          </label>
          <input
            id="asc-owned"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={ownedRaw}
            onChange={(e) => setOwnedRaw(e.currentTarget.value)}
            placeholder="0"
            className={`${fieldClass} tabular-nums`}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="asc-current">
            현재 성급
          </label>
          <select
            id="asc-current"
            value={current}
            onChange={(e) => setCurrent(Number(e.currentTarget.value))}
            className={fieldClass}
          >
            {CURRENT_STARS.map((s) => (
              <option key={s} value={s}>
                {s === 0 ? '0성 (미승급)' : `${s}성`}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="asc-target">
            목표 성급
          </label>
          <select
            id="asc-target"
            value={target}
            onChange={(e) => setTarget(Number(e.currentTarget.value))}
            className={fieldClass}
          >
            {TARGET_STARS.map((s) => (
              <option key={s} value={s}>
                {s}성
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-5 border-t border-border pt-5" aria-live="polite">
        {invalid ? (
          <p className="rounded-lg border border-border bg-bg px-3 py-4 text-center text-sm text-muted">
            목표 성급을 현재 성급보다 높게 골라주세요.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-raised p-4">
                <p className="text-sm text-muted">
                  {current}성 → {target}성 필요 파편
                </p>
                <p className="mt-1 text-3xl font-extrabold tabular-nums text-accent-strong sm:text-4xl">
                  {fmt(total)}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-raised p-4">
                <p className="text-sm text-muted">보유 {fmt(owned)}개 기준 부족분</p>
                <p
                  className={`mt-1 text-3xl font-extrabold tabular-nums sm:text-4xl ${
                    enough ? 'text-success' : 'text-text'
                  }`}
                >
                  {enough ? '충분' : fmt(missing)}
                </p>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto rounded-xl border border-border">
              <table className="w-full border-collapse text-sm">
                <caption className="sr-only">
                  {tier} 영웅 {current}성에서 {target}성까지 단계별 파편 소요량
                </caption>
                <thead>
                  <tr className="bg-raised text-left">
                    <th scope="col" className="px-4 py-3 font-bold whitespace-nowrap">
                      단계
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-bold whitespace-nowrap">
                      소요 파편
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-bold whitespace-nowrap">
                      누적
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {steps.map((step) => (
                    <tr key={step.star} className="border-t border-border">
                      <td className="px-4 py-3 whitespace-nowrap">
                        {step.star - 1}성 → {step.star}성
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{fmt(step.cost)}</td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums">
                        {fmt(step.cumulative)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
