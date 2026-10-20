import { isDeepStrictEqual } from 'node:util';

/** Append verified rows without overwriting upstream data; disagreements require review. */
export function mergeConstructionSupplement(buildings, supplement) {
  if (supplement.version !== 1) throw new Error('Unsupported construction supplement version');
  const result = structuredClone(buildings);
  for (const extra of supplement.buildings) {
    const building = result.find(b => b.id === extra.id);
    if (!building) throw new Error(`Supplement building missing: ${extra.id}`);
    for (const step of extra.steps) {
      if (!Number.isInteger(step.level) || step.level < 1) throw new Error('Invalid supplemental level');
      for (const key of ['bread', 'wood', 'stone', 'iron', 'truegold', 'temperedTruegold', 'seconds', 'power']) {
        if (!Number.isFinite(step[key]) || step[key] < 0) throw new Error(`Invalid supplement ${step.level}/${key}`);
      }
      for (const [id, level] of Object.entries(step.requirements)) {
        if (!result.some(b => b.id === id) || !Number.isInteger(level) || level < 1) throw new Error(`Invalid supplemental prerequisite ${id}/${level}`);
      }
      const existing = building.steps.find(s => s.level === step.level);
      if (existing) {
        if (!isDeepStrictEqual(existing, step)) throw new Error(`Supplement conflicts with upstream ${extra.id}/${step.level}`);
      } else {
        const previous = building.steps.at(-1)?.level;
        if ((step.fromLevel ?? step.level - 1) !== previous) throw new Error(`Supplement gap ${extra.id}/${step.level}`);
        building.steps.push(structuredClone(step));
      }
    }
  }
  return result;
}
