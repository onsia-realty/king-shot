import { useCalculatorLocale } from '@/lib/calculator-locale';
import { useMemo, useState } from 'react';
import BasicBuildingCalculator from './BasicBuildingCalculator';
import { CONSTRUCTION_BUILDINGS, CONSTRUCTION_REFERENCE_MIN_LEVEL, CONSTRUCTION_REFERENCE_SUPPORT_IDS } from '@/data/construction-costs';
import { adjustedTime, levelLabel, planConstruction, RESOURCE_KEYS, RESOURCE_LABELS, type ConstructionBuilding } from '@/lib/construction';

const buildings: readonly ConstructionBuilding[] = CONSTRUCTION_BUILDINGS.filter(b => b.id === 'town-center' || (CONSTRUCTION_REFERENCE_SUPPORT_IDS as readonly string[]).includes(b.id));
const town = buildings.find(b => b.id === 'town-center')!;
const initialCurrents = () => Object.fromEntries(buildings.map(b => [b.id, b.id === town.id ? 30 : 25]));
const initialTargets = () => ({ [town.id]: 35 });
const fmt = (value: number) => value.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
function duration(value: number) {
  const seconds = Math.round(value);
  if (!seconds) return '0초';
  return [Math.floor(seconds / 86400) && `${fmt(Math.floor(seconds / 86400))}일`, Math.floor(seconds % 86400 / 3600) && `${Math.floor(seconds % 86400 / 3600)}시간`, Math.floor(seconds % 3600 / 60) && `${Math.floor(seconds % 3600 / 60)}분`, seconds % 60 && `${seconds % 60}초`].filter(Boolean).join(' ');
}
const field = 'w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-text focus-visible:outline-2 focus-visible:outline-accent';

export default function BuildingCalculator() {
  const { t: ui, text: tx } = useCalculatorLocale();
  const [currents, setCurrents] = useState<Record<string, number>>(initialCurrents);
  const [targets, setTargets] = useState<Record<string, number>>(initialTargets);
  const [bonusRaw, setBonusRaw] = useState('0');
  const [doubleTime, setDoubleTime] = useState(false);
  const [petBonus, setPetBonus] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const bonus = bonusRaw.trim() === '' ? 0 : Number(bonusRaw);
  const result = useMemo(() => {
    try {
      adjustedTime(0, bonus, doubleTime, petBonus);
      return { plan: planConstruction(buildings, currents, targets), error: '' };
    } catch (error) {
      return { plan: null, error: error instanceof Error ? error.message : '계산할 수 없습니다.' };
    }
  }, [currents, targets, bonus, doubleTime, petBonus]);
  const select = (id: string, kind: 'current' | 'target') => {
    const building = buildings.find(b => b.id === id)!;
    const levels = [...new Set([CONSTRUCTION_REFERENCE_MIN_LEVEL, ...building.steps.map(s => s.level)])].filter(level => level >= (kind === 'current' ? CONSTRUCTION_REFERENCE_MIN_LEVEL : currents[id])).sort((a, b) => a - b);
    return <select id={`construction-${id}-${kind}`} className={field} value={kind === 'current' ? currents[id] : targets[id] ?? ''} onChange={event => {
      const raw = event.currentTarget.value;
      if (kind === 'current') {
        const value = Number(raw);
        setCurrents(previous => ({ ...previous, [id]: value }));
        setTargets(previous => previous[id] === undefined ? previous : ({ ...previous, [id]: Math.max(previous[id], value) }));
      } else if (raw === '') setTargets(previous => { const next = { ...previous }; delete next[id]; return next; });
      else setTargets(previous => ({ ...previous, [id]: Number(raw) }));
    }}>
      {kind === 'target' && id !== town.id && <option value="">{ui("자동 · 선행 조건만", "Auto · prerequisites only")}</option>}
      {levels.map(level => <option key={level} value={level}>{tx(levelLabel(level))}</option>)}
    </select>;
  };
  const plan = result.plan;
  const time = (seconds: number) => adjustedTime(seconds, bonus, doubleTime, petBonus);
  const adjusted = plan ? time(plan.totals.seconds) : 0;
  const reduction = plan ? (1 - time(1)) * 100 : 0;
  const townRows = plan?.rows.filter(row => row.buildingId === town.id) ?? [];
  const stepLabel = (level: number) => level <= 30 ? ui(`${level}레벨`, `Level ${level}`) : `TG${Math.ceil((level - 30) / 5)}${(level - 30) % 5 ? ` ${(level - 31) % 5 + 1}/5` : ''}`;
  const supportDefaults = buildings.filter(b => b.id !== town.id).every(b => currents[b.id] === 25);
  const townGold = plan?.rows.filter(row => row.buildingId === town.id).reduce((sum, row) => sum + row.truegold, 0) ?? 0;
  return <div className="space-y-4">
    <form className="rounded-xl border border-border bg-surface/60 p-4 sm:p-6" onSubmit={event => event.preventDefault()} onReset={() => {
      setCurrents(initialCurrents()); setTargets(initialTargets()); setBonusRaw('0'); setDoubleTime(false); setPetBonus(0);
    }}>
      <h2 className="text-lg font-bold">{ui("도시센터", "Town Center")}</h2>
      <p className="mt-1 text-xs text-muted">{ui("한 단계만 계산하려면: 현재 TG5 → 목표 TG6 1/5를 선택하세요.", "For one step only: select current TG5 → target TG6 1/5.")}</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="min-w-0"><label className="mb-1 block text-xs font-semibold" htmlFor={`construction-${town.id}-current`}>{ui("현재 레벨", "Current level")}</label>{select(town.id, 'current')}</div>
        <div className="min-w-0"><label className="mb-1 block text-xs font-semibold" htmlFor={`construction-${town.id}-target`}>{ui("목표 레벨 →", "Target level →")}</label>{select(town.id, 'target')}</div>
      </div>
      <section className="mt-4" aria-label={ui("필요 순금과 건설 시간", "Required Truegold and construction time")} aria-live="polite">
        {result.error ? <p role="alert" className="rounded-xl border border-border bg-bg p-4">{tx(result.error)}</p> : plan && <>
          <div className={`grid gap-3 ${plan.totals.temperedTruegold > 0 ? 'grid-cols-2' : ''}`}>
            <div className="min-w-0 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold"><svg aria-hidden="true" viewBox="0 0 32 24" className="h-6 w-8 shrink-0 text-amber-500" fill="currentColor"><path d="M7 4h18l5 15H2L7 4Z"/><path d="m7 4 5 7h13M12 11 8 19" fill="none" stroke="currentColor" className="text-bg" strokeWidth="1.5"/></svg>{ui("필요 순금 총합", "Total Truegold required")}</h3>
              <p className="mt-2 break-words text-3xl font-extrabold tabular-nums tracking-tight sm:text-4xl">{fmt(plan.totals.truegold)}<span className="ml-1 text-sm font-medium">{ui("개", " items")}</span></p>
              <p className="mt-1 text-xs text-muted">{ui("선행 건물 포함", "Includes prerequisite buildings")}</p>
            </div>
            {plan.totals.temperedTruegold > 0 && <div className="min-w-0 rounded-xl border border-border bg-raised p-4"><h3 className="text-sm font-semibold">{ui("담금질 순금", "Tempered Truegold")}</h3><p className="mt-2 break-words text-3xl font-extrabold tabular-nums tracking-tight sm:text-4xl">{fmt(plan.totals.temperedTruegold)}<span className="ml-1 text-sm font-medium">{ui("개", " items")}</span></p><p className="mt-1 text-xs text-muted">{ui("추가로 필요한 자원", "Additional resources required")}</p></div>}
          </div>
          <div className="mt-3 rounded-xl border border-border bg-raised p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 text-accent-strong" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></svg>{ui("건설시간 합계", "Total construction time")}</h3>
            <p className="mt-2 text-2xl font-extrabold tabular-nums leading-tight text-accent-strong sm:text-3xl">{tx(duration(adjusted))}</p>
            <p className="mt-1 text-xs text-muted">{ui("선행 건물 포함 · 보너스 적용 · ", "Includes prerequisites · With bonuses · ")}{reduction.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}{ui("% 감소", "% reduction")}</p>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted">{ui("건설시간의 합계이며 실제 완료 시각은 아닙니다. 병렬 건설·도움·가속 아이템 제외.", "Sum of construction times, not a completion date. Excludes parallel construction, help, and speedups.")}</p>
        </>}
      </section>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <p className="text-muted">{tx(supportDefaults ? '다른 건물 현재 25레벨 (기본)' : '다른 건물 현재 레벨: 사용자 설정')}{ui(" · 선행 건물 자동 포함", " · Prerequisites included automatically")}</p>
        <button type="button" className="min-h-9 font-semibold text-accent-strong underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-accent" aria-expanded={settingsOpen} aria-controls="construction-building-settings" onClick={() => setSettingsOpen(previous => !previous)}>{ui("레벨 수정", "Edit levels")}</button>
      </div>
      <fieldset className="mt-3 border-t border-border pt-3">
        <legend className="sr-only">{ui("건설 시간 보정", "Construction time adjustments")}</legend>
        <div className="grid gap-3 sm:grid-cols-3 sm:items-start">
        <div className="min-w-0"><label className="mb-1 block text-xs font-semibold" htmlFor="construction-speed">{ui("건설 속도 보너스 (%)", "Construction speed bonus (%)")}</label><input id="construction-speed" className={field} type="number" min="0" step="any" inputMode="decimal" value={bonusRaw} onChange={event => setBonusRaw(event.currentTarget.value)} aria-describedby="construction-speed-help"/><p id="construction-speed-help" className="mt-1 text-xs text-muted">{ui("소수점 가능 · 예: 12.5", "Decimals allowed · e.g. 12.5")}</p></div>
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={doubleTime} onChange={event => setDoubleTime(event.currentTarget.checked)} className="h-4 w-4 shrink-0"/><span className="text-xs font-semibold">{ui("건설 법령", "Double Time decree")}<span className="sr-only"> (Double Time)</span><span className="mt-1 block font-normal text-muted">{ui("시간 추가 20% 감소", "Additional 20% time reduction")}</span></span></label>
        <div className="min-w-0">
          <label htmlFor="construction-pet" className="mb-1 block text-xs font-semibold">{ui("펫 버프 · 건설 조수", "Pet buff · Construction Helper")}</label>
          <select id="construction-pet" className={field} value={petBonus} onChange={event => setPetBonus(Number(event.currentTarget.value))} aria-describedby="construction-pet-help">
            <option value={0}>{ui("미적용", "None")}</option>
            {[5, 7, 9, 12, 15].map((rate, index) => <option key={rate} value={rate}>{ui(`Lv${index + 1} · +${rate}%`, `Lv${index + 1} · +${rate}%`)}</option>)}
          </select>
          <p id="construction-pet-help" className="mt-1 text-xs text-muted">{ui("펫 제외 건설 속도를 입력하세요. 이미 포함했다면 펫은 미적용 선택.", "Enter construction speed excluding the pet. If already included, select None.")}</p>
          <p className="mt-1 text-xs text-muted">{ui("지속 5분 · 재사용 23시간", "Active for 5 min · Cooldown 23 hr")}</p>
        </div>
        </div>
        {petBonus > 0 && <p className="mt-2 text-xs text-muted">{ui("모든 단계를 펫 버프 활성 중 시작한다고 가정합니다. 재사용 대기시간은 합계에서 제외됩니다.", "Assumes every step starts while the pet buff is active. Cooldown waiting time is excluded from totals.")}</p>}
      </fieldset>
      {plan && <section className="mt-4 rounded-xl border border-border p-4" aria-labelledby="construction-town-steps">
        <h3 id="construction-town-steps" className="font-bold">{ui("도시센터 · 선택 구간 단계별 비용", "Town Center · selected upgrade steps")}</h3>
        <p className="mt-1 text-xs text-muted">{ui("아래는 도시센터만의 비용입니다. 위 합계에는 선행 건물과 별도 지정한 목표도 포함됩니다.", "These costs are for Town Center only. Totals above also include prerequisites and other selected targets.")}</p>
        {townRows.length ? <ol className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{townRows.map(row => <li key={row.level} className="min-w-0 rounded-lg bg-bg p-3">
          <h4 className="text-sm font-semibold">{stepLabel(row.fromLevel ?? row.level - 1)} → {stepLabel(row.level)}</h4>
          <dl className="mt-2 space-y-2 text-sm">
            <div><dt className="text-xs text-muted">{ui("적용 건설시간", "Adjusted construction time")}</dt><dd className="font-semibold tabular-nums">{tx(duration(time(row.seconds)))}{time(row.seconds) >= 86400 && <span className="mt-1 block text-xs font-normal text-muted">{ui(`총 ${fmt(time(row.seconds) / 3600)}시간`, `${fmt(time(row.seconds) / 3600)} hours total`)}</span>}</dd></div>
            <div className="flex justify-between gap-2"><dt>{ui("순금", "Truegold")}</dt><dd className="font-semibold tabular-nums">{fmt(row.truegold)}</dd></div>
            <div className="flex justify-between gap-2"><dt>{ui("담금질 순금", "Tempered Truegold")}</dt><dd className="font-semibold tabular-nums">{fmt(row.temperedTruegold)}</dd></div>
          </dl>
        </li>)}</ol> : <p className="mt-3 text-sm text-muted">{ui("선택 구간에 추가할 도시센터 단계가 없습니다.", "No additional Town Center steps in the selected range.")}</p>}
      </section>}
      <details id="construction-building-settings" open={settingsOpen} onToggle={event => setSettingsOpen(event.currentTarget.open)} className="mt-4 rounded-lg border border-border bg-bg"><summary className="cursor-pointer px-4 py-3 text-sm font-semibold">{ui("고급 설정 · 건물별 현재/목표 레벨", "Advanced · current/target levels by building")}</summary><div className="border-t border-border p-4"><p className="mb-4 text-sm text-muted">{ui("현재 레벨은 이 항목을 접어도 항상 반영됩니다. 목표를 지정하지 않은 건물은 선행 조건에 필요한 만큼만 포함됩니다.", "Current levels apply even when collapsed. Buildings without a target are included only as required by prerequisites.")}</p><div className="space-y-4">{buildings.filter(b => b.id !== town.id).map(building => <fieldset key={building.id} className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2"><legend className="px-1 text-sm font-bold">{tx(building.name)}</legend><div><label htmlFor={`construction-${building.id}-current`} className="mb-1 block text-xs text-muted">{ui("현재 레벨", "Current level")}</label>{select(building.id, 'current')}</div><div><label htmlFor={`construction-${building.id}-target`} className="mb-1 block text-xs text-muted">{ui("목표 레벨 (선택)", "Target level (optional)")}</label>{select(building.id, 'target')}</div></fieldset>)}</div></div></details>
      <div className="mt-5 flex items-center justify-between gap-4 border-t border-border pt-5"><p className="text-sm font-semibold text-accent-strong">{ui("입력 즉시 계산", "Updates as you type")}</p><button type="reset" className="rounded-lg border border-border bg-bg px-5 py-2.5 text-sm font-semibold hover:bg-raised focus-visible:outline-2 focus-visible:outline-accent">{ui("초기화", "Reset")}</button></div>
    </form>
    {plan && <div className="space-y-3">
      <details className="rounded-xl border border-border bg-surface"><summary className="cursor-pointer px-4 py-3 text-sm font-semibold">{ui("일반 자원 · 빵 / 나무 / 석재 / 철", "Resources · Bread / Wood / Stone / Iron")}</summary><p className="px-4 pb-3 text-xs text-muted">{ui("살로의 자원 소모 감소 미적용", "Saul’s resource consumption reduction is not applied.")}</p><dl className="grid grid-cols-2 gap-3 border-t border-border p-4">{RESOURCE_KEYS.slice(0, 4).map((key, index) => <div key={key} className="min-w-0 rounded-lg bg-bg p-3"><dt className="text-xs text-muted">{tx(RESOURCE_LABELS[index])}</dt><dd className="mt-1 break-words text-lg font-bold tabular-nums">{fmt(plan.totals[key])}</dd></div>)}</dl></details>
      <details className="rounded-xl border border-border bg-surface"><summary className="cursor-pointer px-4 py-3 text-sm font-semibold">{ui("건물별 내역 · ", "Building breakdown · ")}{plan.rows.length}{ui("단계", " steps")}</summary><div className="border-t border-border p-4"><dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-muted">{ui("도시센터 순금", "Town Center Truegold")}</dt><dd className="font-bold tabular-nums">{fmt(townGold)}{ui("개", " items")}</dd></div><div><dt className="text-muted">{ui("그 외 건물 순금", "Other buildings: Truegold")}</dt><dd className="font-bold tabular-nums">{fmt(plan.totals.truegold - townGold)}{ui("개", " items")}</dd></div></dl><p className="mt-2 text-xs text-muted">{ui("그 외 건물에는 선행 건물과 직접 지정한 목표가 포함됩니다.", "Other buildings include prerequisites and manually selected targets.")}</p>{plan.summary.length ? <ul className="mt-3 grid gap-3 sm:grid-cols-2">{plan.summary.map(item => <li key={item.id} className="rounded-lg border border-border bg-bg p-3"><p className="font-semibold">{tx(item.name)} <span className="text-xs font-normal text-muted">{tx(item.automatic ? '선행 조건 자동 포함' : '직접 지정')}</span></p><p className="mt-1 text-sm">{tx(levelLabel(item.current))} → {tx(levelLabel(item.target))}</p></li>)}</ul> : <p className="mt-3 text-sm text-muted">{ui("추가로 건설할 단계가 없습니다.", "No additional construction steps.")}</p>}<p className="mt-4 text-xs leading-relaxed text-muted">{ui("기본 건설시간 ", "Base construction time ")}{tx(duration(plan.totals.seconds))}<br/>{ui("적용 시간 = 기본 시간 ÷ (1 + (건설 속도 + 펫 속도) ÷ 100)", "Adjusted time = base time ÷ (1 + (construction speed + pet speed) ÷ 100)")}{ui(" · 법령 적용 시 × 0.8", " · With decree: × 0.8")}</p></div></details>
    </div>}
    {plan && plan.rows.length > 0 && <details className="rounded-xl border border-border bg-surface"><summary className="cursor-pointer px-4 py-3 font-bold">{ui("단계별 자원 · 선행 조건", "Resources and prerequisites by step")}</summary><div className="overflow-x-auto border-t border-border" tabIndex={0} role="region" aria-label={ui("건설 단계 상세 표", "Construction step details")}><table className="w-full border-collapse whitespace-nowrap text-sm"><caption className="sr-only">{ui("선행 건물 순서에 따른 비용과 시간. 전투력은 원자료 값이며 미확인 값은 대시입니다.", "Costs and time in prerequisite order. Power is from the source data; unverified values are shown as a dash.")}</caption><thead><tr className="bg-raised">{['건물', '도달 레벨', '선행 조건', ...RESOURCE_LABELS, '기본 시간', '적용 시간', '전투력 (원자료)'].map(label => <th key={label} scope="col" className="px-4 py-3 text-left">{tx(label)}</th>)}</tr></thead><tbody>{plan.rows.map(row => <tr key={`${row.buildingId}-${row.level}`} className="border-t border-border"><th scope="row" className="px-4 py-3 text-left">{tx(row.buildingName)}</th><td className="px-4 py-3">{tx(levelLabel(row.level))}</td><td className="px-4 py-3">{tx(Object.entries(row.requirements).map(([id, level]) => `${buildings.find(b => b.id === id)?.name ?? id} ${levelLabel(level)}`).join(', ') || '—')}</td>{RESOURCE_KEYS.map(key => <td key={key} className="px-4 py-3 text-right tabular-nums">{fmt(row[key])}</td>)}<td className="px-4 py-3 tabular-nums">{tx(duration(row.seconds))}</td><td className="px-4 py-3 tabular-nums">{tx(duration(time(row.seconds)))}</td><td className="px-4 py-3 text-right tabular-nums">{tx(row.power == null || row.power === 0 ? '—' : fmt(row.power))}</td></tr>)}</tbody></table></div></details>}
    <details className="rounded-xl border border-border bg-surface"><summary className="cursor-pointer px-4 py-3 font-bold">{ui("일반 건물 1~30레벨 개별 계산", "Individual building calculator · levels 1–30")}</summary><div className="border-t border-border p-4"><p className="mb-4 text-sm text-muted">{ui("일반 건물 한 종류의 비용을 계산합니다. 선행 건물 자동 계획은 위의 25레벨 이상 계산기를 이용해 주세요.", "Calculate costs for one building type. Use the level 25+ calculator above for automatic prerequisite planning.")}</p><p className="mb-4 text-xs text-muted">{ui("별도 계산기입니다. 위 펫 선택은 적용되지 않습니다.", "This is a separate calculator. The pet selection above does not apply.")}</p><BasicBuildingCalculator /></div></details>
  </div>;
}
