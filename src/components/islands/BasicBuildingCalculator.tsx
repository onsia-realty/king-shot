import { useCalculatorLocale } from '@/lib/calculator-locale';
import { useMemo, useState } from 'react';
import {
  BUILDING_COSTS,
  BUILDING_MAX_LEVEL,
  BUILDING_MIN_LEVEL,
  type BuildingLevelCost,
} from '@/data/building-costs';

/**
 * 건물 업그레이드 계산기.
 *
 * 데이터는 src/data/building-costs.ts 표를 그대로 쓴다.
 * 각 행의 첫 값은 "도달하는 레벨"이라서, 현재 레벨보다 크고 목표 레벨 이하인
 * 행만 더하면 그 구간의 총 소요량이 나온다.
 */

const CURRENT_LEVELS = Array.from(
  { length: BUILDING_MAX_LEVEL - BUILDING_MIN_LEVEL },
  (_, i) => BUILDING_MIN_LEVEL + i,
);
const TARGET_LEVELS = Array.from(
  { length: BUILDING_MAX_LEVEL - BUILDING_MIN_LEVEL },
  (_, i) => BUILDING_MIN_LEVEL + 1 + i,
);

function toSafeInt(raw: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

function clampLevel(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function fmt(n: number): string {
  return n.toLocaleString('ko-KR');
}

/** 초를 `3일 12시간 30분` 꼴로 바꾼다. 0인 단위는 생략한다. */
function fmtDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  if (total < 60) return '1분 미만';
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${fmt(days)}일`);
  if (hours > 0) parts.push(`${hours}시간`);
  if (minutes > 0) parts.push(`${minutes}분`);
  return parts.join(' ');
}

interface Totals {
  bread: number;
  wood: number;
  stone: number;
  iron: number;
  seconds: number;
}

const EMPTY_TOTALS: Totals = { bread: 0, wood: 0, stone: 0, iron: 0, seconds: 0 };

export default function BasicBuildingCalculator() {
  const { t: ui, text: tx } = useCalculatorLocale();
  const [slug, setSlug] = useState(BUILDING_COSTS[0].slug);
  const [current, setCurrent] = useState(1);
  const [target, setTarget] = useState(BUILDING_MAX_LEVEL);
  const [bonusRaw, setBonusRaw] = useState('');

  const building = useMemo(
    () => BUILDING_COSTS.find((b) => b.slug === slug) ?? BUILDING_COSTS[0],
    [slug],
  );

  const bonus = toSafeInt(bonusRaw);
  const safeCurrent = clampLevel(current, BUILDING_MIN_LEVEL, BUILDING_MAX_LEVEL - 1);
  const safeTarget = clampLevel(target, BUILDING_MIN_LEVEL + 1, BUILDING_MAX_LEVEL);
  const invalid = safeTarget <= safeCurrent;

  const rows = useMemo<readonly BuildingLevelCost[]>(() => {
    if (invalid) return [];
    return building.levels.filter((row) => row[0] > safeCurrent && row[0] <= safeTarget);
  }, [building, safeCurrent, safeTarget, invalid]);

  const totals = useMemo<Totals>(() => {
    return rows.reduce<Totals>(
      (acc, row) => ({
        bread: acc.bread + row[1],
        wood: acc.wood + row[2],
        stone: acc.stone + row[3],
        iron: acc.iron + row[4],
        seconds: acc.seconds + row[5],
      }),
      EMPTY_TOTALS,
    );
  }, [rows]);

  const adjustedSeconds = totals.seconds / (1 + bonus / 100);

  const fieldClass =
    'w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-muted';
  const labelClass = 'mb-1.5 block text-sm font-semibold text-muted';

  const tiles: readonly { key: string; label: string; value: number }[] = [
    { key: 'bread', label: '빵', value: totals.bread },
    { key: 'wood', label: '나무', value: totals.wood },
    { key: 'stone', label: '석재', value: totals.stone },
    { key: 'iron', label: '철', value: totals.iron },
  ];

  return (
    <div className="rounded-xl border border-border bg-surface/60 p-4 sm:p-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="basic-bld-building">{ui("건물", "Building")}</label>
          <select
            id="basic-bld-building"
            value={slug}
            onChange={(e) => setSlug(e.currentTarget.value)}
            className={fieldClass}
          >
            {BUILDING_COSTS.map((b) => (
              <option key={b.slug} value={b.slug}>
                {tx(b.name)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="basic-bld-bonus">{ui("건설 속도 보너스 % (선택)", "Construction speed bonus % (optional)")}</label>
          <input
            id="basic-bld-bonus"
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            value={bonusRaw}
            onChange={(e) => setBonusRaw(e.currentTarget.value)}
            placeholder="0"
            className={`${fieldClass} tabular-nums`}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="basic-bld-current">{ui("현재 레벨", "Current level")}</label>
          <select
            id="basic-bld-current"
            value={safeCurrent}
            onChange={(e) => setCurrent(Number(e.currentTarget.value))}
            className={fieldClass}
          >
            {CURRENT_LEVELS.map((lv) => (
              <option key={lv} value={lv}>
                {lv}{ui("레벨", " level")}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="basic-bld-target">{ui("목표 레벨", "Target level")}</label>
          <select
            id="basic-bld-target"
            value={safeTarget}
            onChange={(e) => setTarget(Number(e.currentTarget.value))}
            className={fieldClass}
          >
            {TARGET_LEVELS.map((lv) => (
              <option key={lv} value={lv}>
                {lv}{ui("레벨", " level")}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-5 border-t border-border pt-5" aria-live="polite">
        {invalid ? (
          <p className="rounded-lg border border-border bg-bg px-3 py-4 text-center text-sm text-muted">{ui("목표 레벨을 현재 레벨보다 높게 설정해 주세요.", "Set the target level above the current level.")}</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {tiles.map((tile) => (
                <div key={tile.key} className="rounded-xl border border-border bg-raised p-4">
                  <p className="text-sm text-muted">{tx(tile.label)}</p>
                  <p className="mt-1 text-xl font-extrabold tabular-nums text-accent-strong sm:text-2xl">
                    {fmt(tile.value)}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-xl border border-border bg-raised p-4">
              <p className="text-sm text-muted">
                {tx(building.name)} {safeCurrent}{ui("레벨 → ", " → ")}{safeTarget}{ui("레벨 총 소요 시간", " · total time")}{tx(bonus > 0 ? ` (건설 속도 +${fmt(bonus)}% 반영)` : '')}
              </p>
              <p className="mt-1 text-2xl font-extrabold tabular-nums text-accent-strong sm:text-3xl">
                {tx(fmtDuration(adjustedSeconds))}
              </p>
              {bonus > 0 ? (
                <p className="mt-1 text-sm text-muted tabular-nums">{ui("보너스 없을 때 ", "Without bonuses ")}{tx(fmtDuration(totals.seconds))}
                </p>
              ) : null}
            </div>

            <details className="mt-4 rounded-xl border border-border bg-bg">
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">{ui("레벨별 상세 보기 (", "Details by level (")}{rows.length}{ui("단계)", " steps)")}</summary>
              <div className="overflow-x-auto border-t border-border">
                <table className="w-full border-collapse text-sm">
                  <caption className="sr-only">
                    {tx(building.name)} {safeCurrent}{ui("레벨에서 ", " to ")}{safeTarget}{ui("레벨까지 단계별 자원과 시간", " · resources and time by step")}</caption>
                  <thead>
                    <tr className="bg-raised text-left">
                      <th scope="col" className="px-4 py-3 font-bold whitespace-nowrap">{ui("레벨", " level")}</th>
                      <th scope="col" className="px-4 py-3 text-right font-bold whitespace-nowrap">{ui("빵", "Bread")}</th>
                      <th scope="col" className="px-4 py-3 text-right font-bold whitespace-nowrap">{ui("나무", "Wood")}</th>
                      <th scope="col" className="px-4 py-3 text-right font-bold whitespace-nowrap">{ui("석재", "Stone")}</th>
                      <th scope="col" className="px-4 py-3 text-right font-bold whitespace-nowrap">{ui("철", "Iron")}</th>
                      <th scope="col" className="px-4 py-3 text-right font-bold whitespace-nowrap">{ui("시간", "Time")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row[0]} className="border-t border-border">
                        <th scope="row" className="px-4 py-3 text-left font-bold whitespace-nowrap">
                          {row[0] - 1} → {row[0]}
                        </th>
                        <td className="px-4 py-3 text-right tabular-nums">{fmt(row[1])}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{fmt(row[2])}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{fmt(row[3])}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{fmt(row[4])}</td>
                        <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                          {tx(fmtDuration(row[5] / (1 + bonus / 100)))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}
      </div>
    </div>
  );
}

