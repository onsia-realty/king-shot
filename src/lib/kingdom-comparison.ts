export const comparisonMetrics = [
  ['personal_power', '전투력', 'Power'], ['kills', '처치 수', 'Kills'],
  ['research_power', '연구 전투력', 'Research Power'],
  ['hero_total', '영웅 전투력', 'Hero Power'], ['hero_equip', '영웅 장비', 'Hero Gear'],
  ['gov_gear', '영주 장비', 'Governor Gear'], ['gov_charm', '영주 보석', 'Governor Charms'],
  ['pet_power', '펫 전투력', 'Pet Power'], ['mystic_trial', '신비한 시련', 'Mystic Trial'],
] as const;
export type ComparisonBoard = typeof comparisonMetrics[number][0];
export interface ComparisonRow {
  rank: number; uid: string | null; governor_id: string | null;
  nick_name: string; score: number; kid: number;
  alliance_abbr: string | null; avatar_url: string | null;
}
export interface ComparisonSnapshot {
  ok: true; kid: number; board: ComparisonBoard; captured_at: number | null; rows: ComparisonRow[];
}
export function summarizeRanking(rows: readonly ComparisonRow[] | null, limit: number) {
  // Each metric selects its own participants. Sort a copy, never the source snapshot.
  const selected = rows ? [...rows].sort((a, b) => a.rank - b.rank).slice(0, limit) : [];
  const sum = selected.reduce((total, row) => total + row.score, 0);
  const total = selected.length && selected.every(row => Number.isFinite(row.score) && row.score >= 0) && Number.isFinite(sum) ? sum : null;
  return { rows: selected, count: selected.length, total, complete: total !== null && selected.length === limit };
}
export function compareRankings(left: ReturnType<typeof summarizeRanking>, right: ReturnType<typeof summarizeRanking>) {
  if (!left.complete || !right.complete || left.total === null || right.total === null) {
    return { complete: false, gap: null, leftPercent: null };
  }
  const max = Math.max(left.total, right.total);
  // Scaling before division also avoids overflowing a combined total.
  const leftPercent = max === 0 ? null : (left.total / max) / (left.total / max + right.total / max) * 100;
  return { complete: true, gap: Math.abs(left.total - right.total), leftPercent };
}
