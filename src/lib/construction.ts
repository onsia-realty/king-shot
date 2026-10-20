export interface ConstructionStep {
  level: number;
  fromLevel?: number;
  bread: number;
  wood: number;
  stone: number;
  iron: number;
  truegold: number;
  temperedTruegold: number;
  seconds: number;
  power?: number;
  requirements: Record<string, number>;
}

export interface ConstructionBuilding {
  id: string;
  name: string;
  steps: readonly ConstructionStep[];
}

export const RESOURCE_KEYS = ['bread', 'wood', 'stone', 'iron', 'truegold', 'temperedTruegold'] as const;
export const RESOURCE_LABELS = ['빵', '나무', '석재', '철', '순금 (TG)', '담금질 순금'] as const;

export function levelLabel(level: number): string {
  if (level <= 30) return `${level}레벨`;
  const tier = Math.ceil((level - 30) / 5);
  const part = (level - 31) % 5 + 1;
  return part === 5 ? `순금 ${tier}` : `순금 ${tier} · ${part}/5`;
}

export function supportedRange(building: ConstructionBuilding) {
  const levels = building.steps.map(step => step.level);
  return { min: Math.max(1, Math.min(...levels) - 1), max: Math.max(...levels) };
}

export function adjustedTime(seconds: number, bonus: number, doubleTime = false, petBonus = 0): number {
  if (!Number.isFinite(bonus) || bonus < 0) throw new Error('건설 속도는 0 이상의 유한한 숫자로 입력해 주세요.');
  if (!Number.isFinite(petBonus) || petBonus < 0 || petBonus > 15) throw new Error('Pet construction speed bonus must be between 0 and 15%.');
  return seconds / (1 + (bonus + petBonus) / 100) * (doubleTime ? 0.8 : 1);
}

/** Costs for the selected building alone; prerequisites are not traversed. */
export function planBuildingSteps(building: ConstructionBuilding, current: number, target: number) {
  const range = supportedRange(building);
  if (!Number.isInteger(current) || !Number.isInteger(target) || current < range.min || target > range.max) {
    throw new Error(`${building.name}: ${levelLabel(current)} → ${levelLabel(target)} 구간 데이터가 없습니다.`);
  }
  if (target < current) throw new Error(`${building.name}: 목표 레벨은 현재 레벨 이상이어야 합니다.`);
  const byLevel = new Map(building.steps.map(step => [step.level, step]));
  if (!byLevel.has(current) && current !== range.min) throw new Error(`${building.name} ${levelLabel(current)} 데이터가 없습니다.`);
  const rows: ConstructionStep[] = [];
  let level = target;
  while (level > current) {
    const step = byLevel.get(level);
    if (!step) throw new Error(`${building.name} ${levelLabel(level)} 데이터가 없습니다.`);
    for (const key of [...RESOURCE_KEYS, 'seconds'] as const) {
      if (!Number.isFinite(step[key]) || step[key] < 0) throw new Error(`${building.name} ${levelLabel(level)}: ${key} 데이터가 없습니다.`);
    }
    const from = step.fromLevel ?? level - 1;
    if (!Number.isInteger(from) || from >= level || from < current) throw new Error(`${building.name} ${levelLabel(level)}: 현재 레벨에서 연결되는 단계 데이터가 없습니다.`);
    rows.unshift(step);
    level = from;
  }
  const totals = { bread: 0, wood: 0, stone: 0, iron: 0, truegold: 0, temperedTruegold: 0, seconds: 0 };
  for (const row of rows) for (const key of [...RESOURCE_KEYS, 'seconds'] as const) totals[key] += row[key];
  return { rows, totals };
}

/** Close prerequisites to a fixed point, then topologically order individual upgrades. */
export function planConstruction(
  buildings: readonly ConstructionBuilding[],
  currents: Record<string, number>,
  requested: Record<string, number>,
) {
  const catalog = new Map(buildings.map(b => [b.id, b]));
  const targets: Record<string, number> = {};
  const current = (id: string) => {
    const value = currents[id];
    if (!Number.isInteger(value) || value < 0) throw new Error(`${catalog.get(id)?.name ?? id}: 현재 레벨을 입력해 주세요.`);
    return value;
  };
  const raise = (id: string, level: number) => {
    const building = catalog.get(id);
    if (!building) throw new Error(`${id}: 선행 건물 데이터가 없습니다.`);
    if (!Number.isInteger(level) || level < 0) throw new Error(`${building.name}: 레벨이 올바르지 않습니다.`);
    if (level <= current(id) || level <= (targets[id] ?? 0)) return false;
    const range = supportedRange(building);
    if (current(id) < range.min || level > range.max) throw new Error(`${building.name}: ${levelLabel(current(id))} → ${levelLabel(level)} 구간 데이터가 없습니다.`);
    targets[id] = level;
    return true;
  };
  for (const [id, level] of Object.entries(requested)) {
    if (level < current(id)) throw new Error(`${catalog.get(id)?.name ?? id}: 목표 레벨은 현재 레벨 이상이어야 합니다.`);
    raise(id, level);
  }
  const steps = (id: string, target: number) => {
    const building = catalog.get(id)!;
    const byLevel = new Map(building.steps.map(step => [step.level, step]));
    const result: ConstructionStep[] = [];
    let level = target;
    while (level > current(id)) {
      const step = byLevel.get(level);
      if (!step) throw new Error(`${building.name} ${levelLabel(level)} 데이터가 없습니다.`);
      for (const key of [...RESOURCE_KEYS, 'seconds'] as const) {
        if (!Number.isFinite(step[key]) || step[key] < 0) throw new Error(`${building.name} ${levelLabel(level)}: ${key} 데이터가 없습니다.`);
      }
      if (!step.requirements) throw new Error(`${building.name} ${levelLabel(level)}: 선행 조건 데이터가 없습니다.`);
      result.unshift(step);
      const from = step.fromLevel ?? level - 1;
      if (!Number.isInteger(from) || from >= level || from < current(id)) throw new Error(`${building.name} ${levelLabel(level)}: 현재 레벨에서 연결되는 단계 데이터가 없습니다.`);
      level = from;
    }
    return result;
  };
  let changed = true;
  while (changed) {
    changed = false;
    for (const [id, target] of Object.entries(targets)) {
      for (const step of steps(id, target)) {
        for (const [requiredId, level] of Object.entries(step.requirements)) {
          if (raise(requiredId, level)) changed = true;
        }
      }
    }
  }
  type Row = ConstructionStep & { buildingId: string; buildingName: string };
  const nodes = new Map<string, Row>();
  for (const [id, target] of Object.entries(targets)) {
    for (const step of steps(id, target)) nodes.set(`${id}:${step.level}`, { ...step, buildingId: id, buildingName: catalog.get(id)!.name });
  }
  const rows: Row[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const visit = (key: string) => {
    if (visited.has(key)) return;
    if (visiting.has(key)) throw new Error('선행 건물 조건에 순환이 있습니다. 데이터 확인이 필요합니다.');
    const row = nodes.get(key);
    if (!row) throw new Error(`${key}: 선행 단계 데이터가 없습니다.`);
    visiting.add(key);
    const from = row.fromLevel ?? row.level - 1;
    if (from > current(row.buildingId)) visit(`${row.buildingId}:${from}`);
    for (const [id, level] of Object.entries(row.requirements)) {
      if (level > current(id)) visit(`${id}:${level}`);
    }
    visiting.delete(key);
    visited.add(key);
    rows.push(row);
  };
  for (const key of nodes.keys()) visit(key);
  const totals = { bread: 0, wood: 0, stone: 0, iron: 0, truegold: 0, temperedTruegold: 0, seconds: 0 };
  for (const row of rows) for (const key of [...RESOURCE_KEYS, 'seconds'] as const) totals[key] += row[key];
  const summary = Object.entries(targets).map(([id, target]) => ({
    id, name: catalog.get(id)!.name, current: current(id), target,
    automatic: target > (requested[id] ?? current(id)),
  }));
  return { rows, totals, targets, summary };
}
