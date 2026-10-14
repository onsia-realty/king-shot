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
  return <div className="space-y-6">
    <form className="rounded-xl border border-border bg-surface/60 p-4 sm:p-6" onSubmit={event => event.preventDefault()} onReset={() => {
      setCurrents(initialCurrents()); setTargets(initialTargets()); setBonusRaw('0'); setDoubleTime(false);
    }}>
      <h2 className="border-b border-border pb-4 text-xl font-bold">도시센터</h2>
      <p className="mt-4 text-sm text-muted">기본값: 도시센터 30레벨 → 순금 1, 다른 건물 현재 25레벨. 실제 보유 레벨로 바꿔 주세요.</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div><label className="mb-2 block text-sm font-semibold" htmlFor={`construction-${town.id}-current`}>도시센터 현재 레벨</label>{select(town.id, 'current')}</div>
        <div><label className="mb-2 block text-sm font-semibold" htmlFor={`construction-${town.id}-target`}>도시센터 목표 레벨</label>{select(town.id, 'target')}</div>
      </div>
      <details className="mt-5 rounded-lg border border-border bg-bg"><summary className="cursor-pointer px-4 py-3 font-semibold">상세 설정 · 건물별 현재/목표 레벨</summary><div className="border-t border-border p-4"><p className="mb-4 text-sm text-muted">현재 레벨은 이 항목을 접어도 항상 반영됩니다. 목표를 지정하지 않은 건물은 선행 조건에 필요한 만큼만 포함됩니다.</p><div className="space-y-4">{buildings.filter(b => b.id !== town.id).map(building => <fieldset key={building.id} className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2"><legend className="px-1 text-sm font-bold">{building.name}</legend><div><label htmlFor={`construction-${building.id}-current`} className="mb-1 block text-xs text-muted">현재 레벨</label>{select(building.id, 'current')}</div><div><label htmlFor={`construction-${building.id}-target`} className="mb-1 block text-xs text-muted">목표 레벨 (선택)</label>{select(building.id, 'target')}</div></fieldset>)}</div></div></details>
      <fieldset className="mt-5 rounded-lg border border-border bg-bg p-4 sm:p-5">
        <legend className="px-2 text-sm font-bold">건설 시간 보정</legend>
        <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="mb-2 block text-sm font-semibold" htmlFor="construction-speed">건설 속도 보너스 (%)</label><input id="construction-speed" className={field} type="number" min="0" step="any" inputMode="decimal" value={bonusRaw} onChange={event => setBonusRaw(event.currentTarget.value)} aria-describedby="construction-speed-help"/><p id="construction-speed-help" className="mt-1 text-xs text-muted">소수점 입력 가능 · 예: 12.5</p></div>
        <label className="flex items-center gap-3 rounded-lg border border-border bg-bg px-4 py-3"><input type="checkbox" checked={doubleTime} onChange={event => setDoubleTime(event.currentTarget.checked)} className="h-4 w-4"/><span className="text-sm font-semibold">건설 법령 (Double Time)<span className="mt-1 block font-normal text-muted">건설 시간 추가 20% 감소</span></span></label>
        </div>
      </fieldset>
      <div className="mt-5 flex items-center justify-between gap-4 border-t border-border pt-5"><p className="text-sm font-semibold text-accent-strong">입력 즉시 계산</p><button type="reset" className="rounded-lg border border-border bg-bg px-5 py-2.5 text-sm font-semibold hover:bg-raised focus-visible:outline-2 focus-visible:outline-accent">초기화</button></div>
    </form>
    <div aria-live="polite">{result.error ? <p role="alert" className="rounded-xl border border-border bg-surface p-5">{result.error}</p> : plan && <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">{RESOURCE_KEYS.map((key, index) => <div key={key} className="rounded-xl border border-border bg-surface p-4"><p className="text-sm text-muted">{RESOURCE_LABELS[index]}</p><p className="mt-2 break-all text-xl font-extrabold tabular-nums text-accent-strong sm:text-2xl">{fmt(plan.totals[key])}</p></div>)}</div>
      <div className="mt-4 rounded-xl border border-border bg-raised p-5"><h2 className="text-sm font-semibold text-muted">보너스 적용 건설 시간 합계</h2><p className="mt-2 text-2xl font-extrabold tabular-nums text-accent-strong">{duration(adjusted)}</p><p className="mt-2 text-sm text-muted">기본 {duration(plan.totals.seconds)} · {reduction.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}% 감소</p><p className="mt-2 text-xs text-muted">기본 시간 ÷ (1 + 속도 보너스 ÷ 100){doubleTime ? ' × 0.8' : ''}. 단계별 시간 합계이며 병렬 건설·도움·가속 아이템은 제외합니다.</p></div>
      <div className="mt-5 rounded-xl border border-border bg-surface p-5"><h2 className="font-bold">건물별 최종 목표 · {plan.rows.length}단계</h2>{plan.summary.length ? <ul className="mt-3 grid gap-3 sm:grid-cols-2">{plan.summary.map(item => <li key={item.id} className="rounded-lg border border-border bg-bg p-3"><p className="font-semibold">{item.name} <span className="text-xs font-normal text-muted">{item.automatic ? '선행 조건 자동 포함' : '직접 지정'}</span></p><p className="mt-1 text-sm">{levelLabel(item.current)} → {levelLabel(item.target)}</p></li>)}</ul> : <p className="mt-3 text-sm text-muted">추가로 건설할 단계가 없습니다.</p>}</div>
    </>}</div>
    {plan && plan.rows.length > 0 && <details open className="rounded-xl border border-border bg-surface"><summary className="cursor-pointer px-4 py-3 font-bold">단계별 자원 · 선행 조건</summary><div className="overflow-x-auto border-t border-border" tabIndex={0} role="region" aria-label="건설 단계 상세 표"><table className="w-full border-collapse whitespace-nowrap text-sm"><caption className="sr-only">선행 건물 순서에 따른 비용과 시간. 전투력은 원자료 값이며 미확인 값은 대시입니다.</caption><thead><tr className="bg-raised">{['건물', '도달 레벨', '선행 조건', ...RESOURCE_LABELS, '기본 시간', '적용 시간', '전투력 (원자료)'].map(label => <th key={label} scope="col" className="px-4 py-3 text-left">{label}</th>)}</tr></thead><tbody>{plan.rows.map(row => <tr key={`${row.buildingId}-${row.level}`} className="border-t border-border"><th scope="row" className="px-4 py-3 text-left">{row.buildingName}</th><td className="px-4 py-3">{levelLabel(row.level)}</td><td className="px-4 py-3">{Object.entries(row.requirements).map(([id, level]) => `${buildings.find(b => b.id === id)?.name ?? id} ${levelLabel(level)}`).join(', ') || '—'}</td>{RESOURCE_KEYS.map(key => <td key={key} className="px-4 py-3 text-right tabular-nums">{fmt(row[key])}</td>)}<td className="px-4 py-3 tabular-nums">{duration(row.seconds)}</td><td className="px-4 py-3 tabular-nums">{duration(adjustedTime(row.seconds, bonus, doubleTime))}</td><td className="px-4 py-3 text-right tabular-nums">{row.power == null || row.power === 0 ? '—' : fmt(row.power)}</td></tr>)}</tbody></table></div></details>}
    <details className="rounded-xl border border-border bg-surface"><summary className="cursor-pointer px-4 py-3 font-bold">일반 건물 1~30레벨 개별 계산</summary><div className="border-t border-border p-4"><p className="mb-4 text-sm text-muted">일반 건물 한 종류의 비용을 계산합니다. 선행 건물 자동 계획은 위의 25레벨 이상 계산기를 이용해 주세요.</p><BasicBuildingCalculator /></div></details>
  </div>;
}
