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
  const [currents, setCurrents] = useState<Record<string, number>>(initialCurrents);
  const [targets, setTargets] = useState<Record<string, number>>(initialTargets);
  const [bonusRaw, setBonusRaw] = useState('0');
  const [doubleTime, setDoubleTime] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const bonus = bonusRaw.trim() === '' ? 0 : Number(bonusRaw);
  const result = useMemo(() => {
    try {
      adjustedTime(0, bonus, doubleTime);
      return { plan: planConstruction(buildings, currents, targets), error: '' };
    } catch (error) {
      return { plan: null, error: error instanceof Error ? error.message : '계산할 수 없습니다.' };
    }
  }, [currents, targets, bonus, doubleTime]);
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
      {kind === 'target' && id !== town.id && <option value="">자동 · 선행 조건만</option>}
      {levels.map(level => <option key={level} value={level}>{levelLabel(level)}</option>)}
    </select>;
  };
  const plan = result.plan;
  const adjusted = plan ? adjustedTime(plan.totals.seconds, bonus, doubleTime) : 0;
  const reduction = (1 - 1 / (1 + bonus / 100) * (doubleTime ? 0.8 : 1)) * 100;
  const supportDefaults = buildings.filter(b => b.id !== town.id).every(b => currents[b.id] === 25);
  const townGold = plan?.rows.filter(row => row.buildingId === town.id).reduce((sum, row) => sum + row.truegold, 0) ?? 0;
  return <div className="space-y-4">
    <form className="rounded-xl border border-border bg-surface/60 p-4 sm:p-6" onSubmit={event => event.preventDefault()} onReset={() => {
      setCurrents(initialCurrents()); setTargets(initialTargets()); setBonusRaw('0'); setDoubleTime(false);
    }}>
      <h2 className="text-lg font-bold">도시센터</h2>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="min-w-0"><label className="mb-1 block text-xs font-semibold" htmlFor={`construction-${town.id}-current`}>현재 레벨</label>{select(town.id, 'current')}</div>
        <div className="min-w-0"><label className="mb-1 block text-xs font-semibold" htmlFor={`construction-${town.id}-target`}>목표 레벨 →</label>{select(town.id, 'target')}</div>
      </div>
      <section className="mt-4" aria-label="필요 순금과 건설 시간" aria-live="polite">
        {result.error ? <p role="alert" className="rounded-xl border border-border bg-bg p-4">{result.error}</p> : plan && <>
          <div className={`grid gap-3 ${plan.totals.temperedTruegold > 0 ? 'grid-cols-2' : ''}`}>
            <div className="min-w-0 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold"><svg aria-hidden="true" viewBox="0 0 32 24" className="h-6 w-8 shrink-0 text-amber-500" fill="currentColor"><path d="M7 4h18l5 15H2L7 4Z"/><path d="m7 4 5 7h13M12 11 8 19" fill="none" stroke="currentColor" className="text-bg" strokeWidth="1.5"/></svg>필요 순금 총합</h3>
              <p className="mt-2 break-words text-3xl font-extrabold tabular-nums tracking-tight sm:text-4xl">{fmt(plan.totals.truegold)}<span className="ml-1 text-sm font-medium">개</span></p>
              <p className="mt-1 text-xs text-muted">선행 건물 포함</p>
            </div>
            {plan.totals.temperedTruegold > 0 && <div className="min-w-0 rounded-xl border border-border bg-raised p-4"><h3 className="text-sm font-semibold">담금질 순금</h3><p className="mt-2 break-words text-3xl font-extrabold tabular-nums tracking-tight sm:text-4xl">{fmt(plan.totals.temperedTruegold)}<span className="ml-1 text-sm font-medium">개</span></p><p className="mt-1 text-xs text-muted">추가로 필요한 자원</p></div>}
          </div>
          <div className="mt-3 rounded-xl border border-border bg-raised p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 text-accent-strong" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></svg>건설시간 합계</h3>
            <p className="mt-2 text-2xl font-extrabold tabular-nums leading-tight text-accent-strong sm:text-3xl">{duration(adjusted)}</p>
            <p className="mt-1 text-xs text-muted">보너스 적용 · {reduction.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}% 감소</p>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted">건설시간의 합계이며 실제 완료 시각은 아닙니다. 병렬 건설·도움·가속 아이템 제외.</p>
        </>}
      </section>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <p className="text-muted">{supportDefaults ? '다른 건물 현재 25레벨 (기본)' : '다른 건물 현재 레벨: 사용자 설정'} · 선행 건물 자동 포함</p>
        <button type="button" className="min-h-9 font-semibold text-accent-strong underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-accent" aria-expanded={settingsOpen} aria-controls="construction-building-settings" onClick={() => setSettingsOpen(previous => !previous)}>레벨 수정</button>
      </div>
      <fieldset className="mt-3 border-t border-border pt-3">
        <legend className="sr-only">건설 시간 보정</legend>
        <div className="grid grid-cols-2 items-center gap-3">
        <div className="min-w-0"><label className="mb-1 block text-xs font-semibold" htmlFor="construction-speed">건설 속도 보너스 (%)</label><input id="construction-speed" className={field} type="number" min="0" step="any" inputMode="decimal" value={bonusRaw} onChange={event => setBonusRaw(event.currentTarget.value)} aria-describedby="construction-speed-help"/><p id="construction-speed-help" className="mt-1 text-xs text-muted">소수점 가능 · 예: 12.5</p></div>
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={doubleTime} onChange={event => setDoubleTime(event.currentTarget.checked)} className="h-4 w-4 shrink-0"/><span className="text-xs font-semibold">건설 법령<span className="sr-only"> (Double Time)</span><span className="mt-1 block font-normal text-muted">시간 추가 20% 감소</span></span></label>
        </div>
      </fieldset>
      <details id="construction-building-settings" open={settingsOpen} onToggle={event => setSettingsOpen(event.currentTarget.open)} className="mt-4 rounded-lg border border-border bg-bg"><summary className="cursor-pointer px-4 py-3 text-sm font-semibold">고급 설정 · 건물별 현재/목표 레벨</summary><div className="border-t border-border p-4"><p className="mb-4 text-sm text-muted">현재 레벨은 이 항목을 접어도 항상 반영됩니다. 목표를 지정하지 않은 건물은 선행 조건에 필요한 만큼만 포함됩니다.</p><div className="space-y-4">{buildings.filter(b => b.id !== town.id).map(building => <fieldset key={building.id} className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2"><legend className="px-1 text-sm font-bold">{building.name}</legend><div><label htmlFor={`construction-${building.id}-current`} className="mb-1 block text-xs text-muted">현재 레벨</label>{select(building.id, 'current')}</div><div><label htmlFor={`construction-${building.id}-target`} className="mb-1 block text-xs text-muted">목표 레벨 (선택)</label>{select(building.id, 'target')}</div></fieldset>)}</div></div></details>
      <div className="mt-5 flex items-center justify-between gap-4 border-t border-border pt-5"><p className="text-sm font-semibold text-accent-strong">입력 즉시 계산</p><button type="reset" className="rounded-lg border border-border bg-bg px-5 py-2.5 text-sm font-semibold hover:bg-raised focus-visible:outline-2 focus-visible:outline-accent">초기화</button></div>
    </form>
    {plan && <div className="space-y-3">
      <details className="rounded-xl border border-border bg-surface"><summary className="cursor-pointer px-4 py-3 text-sm font-semibold">일반 자원 · 빵 / 나무 / 석재 / 철</summary><dl className="grid grid-cols-2 gap-3 border-t border-border p-4">{RESOURCE_KEYS.slice(0, 4).map((key, index) => <div key={key} className="min-w-0 rounded-lg bg-bg p-3"><dt className="text-xs text-muted">{RESOURCE_LABELS[index]}</dt><dd className="mt-1 break-words text-lg font-bold tabular-nums">{fmt(plan.totals[key])}</dd></div>)}</dl></details>
      <details className="rounded-xl border border-border bg-surface"><summary className="cursor-pointer px-4 py-3 text-sm font-semibold">건물별 내역 · {plan.rows.length}단계</summary><div className="border-t border-border p-4"><dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-muted">도시센터 순금</dt><dd className="font-bold tabular-nums">{fmt(townGold)}개</dd></div><div><dt className="text-muted">그 외 건물 순금</dt><dd className="font-bold tabular-nums">{fmt(plan.totals.truegold - townGold)}개</dd></div></dl><p className="mt-2 text-xs text-muted">그 외 건물에는 선행 건물과 직접 지정한 목표가 포함됩니다.</p>{plan.summary.length ? <ul className="mt-3 grid gap-3 sm:grid-cols-2">{plan.summary.map(item => <li key={item.id} className="rounded-lg border border-border bg-bg p-3"><p className="font-semibold">{item.name} <span className="text-xs font-normal text-muted">{item.automatic ? '선행 조건 자동 포함' : '직접 지정'}</span></p><p className="mt-1 text-sm">{levelLabel(item.current)} → {levelLabel(item.target)}</p></li>)}</ul> : <p className="mt-3 text-sm text-muted">추가로 건설할 단계가 없습니다.</p>}<p className="mt-4 text-xs leading-relaxed text-muted">기본 건설시간 {duration(plan.totals.seconds)}<br/>적용 시간 = 기본 시간 ÷ (1 + 속도 보너스 ÷ 100){doubleTime ? ' × 0.8' : ''}</p></div></details>
    </div>}
    {plan && plan.rows.length > 0 && <details className="rounded-xl border border-border bg-surface"><summary className="cursor-pointer px-4 py-3 font-bold">단계별 자원 · 선행 조건</summary><div className="overflow-x-auto border-t border-border" tabIndex={0} role="region" aria-label="건설 단계 상세 표"><table className="w-full border-collapse whitespace-nowrap text-sm"><caption className="sr-only">선행 건물 순서에 따른 비용과 시간. 전투력은 원자료 값이며 미확인 값은 대시입니다.</caption><thead><tr className="bg-raised">{['건물', '도달 레벨', '선행 조건', ...RESOURCE_LABELS, '기본 시간', '적용 시간', '전투력 (원자료)'].map(label => <th key={label} scope="col" className="px-4 py-3 text-left">{label}</th>)}</tr></thead><tbody>{plan.rows.map(row => <tr key={`${row.buildingId}-${row.level}`} className="border-t border-border"><th scope="row" className="px-4 py-3 text-left">{row.buildingName}</th><td className="px-4 py-3">{levelLabel(row.level)}</td><td className="px-4 py-3">{Object.entries(row.requirements).map(([id, level]) => `${buildings.find(b => b.id === id)?.name ?? id} ${levelLabel(level)}`).join(', ') || '—'}</td>{RESOURCE_KEYS.map(key => <td key={key} className="px-4 py-3 text-right tabular-nums">{fmt(row[key])}</td>)}<td className="px-4 py-3 tabular-nums">{duration(row.seconds)}</td><td className="px-4 py-3 tabular-nums">{duration(adjustedTime(row.seconds, bonus, doubleTime))}</td><td className="px-4 py-3 text-right tabular-nums">{row.power == null || row.power === 0 ? '—' : fmt(row.power)}</td></tr>)}</tbody></table></div></details>}
    <details className="rounded-xl border border-border bg-surface"><summary className="cursor-pointer px-4 py-3 font-bold">일반 건물 1~30레벨 개별 계산</summary><div className="border-t border-border p-4"><p className="mb-4 text-sm text-muted">일반 건물 한 종류의 비용을 계산합니다. 선행 건물 자동 계획은 위의 25레벨 이상 계산기를 이용해 주세요.</p><BasicBuildingCalculator /></div></details>
  </div>;
}
