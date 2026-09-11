/**
 * 영웅 파편 업그레이드 차트.
 *
 * 영웅별 데이터가 아니라 사이트 공통 상수다. 모든 영웅이 같은 표를 쓴다.
 * 행은 등급(T1~T6), 열은 별 레벨(1~5성)이고 값은 필요한 파편 수다.
 * T6 행은 다른 행과 패턴이 다른데, 원본 데이터가 그렇다.
 */

export const HERO_SHARD_STARS = [1, 2, 3, 4, 5] as const;

export type HeroShardTier = 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'T6';

export interface HeroShardRow {
  tier: HeroShardTier;
  /** 1성 → 5성 순서의 파편 수 */
  counts: readonly [number, number, number, number, number];
}

export const HERO_SHARD_ROWS: readonly HeroShardRow[] = [
  { tier: 'T1', counts: [1, 5, 15, 40, 100] },
  { tier: 'T2', counts: [1, 5, 15, 40, 100] },
  { tier: 'T3', counts: [2, 5, 15, 40, 100] },
  { tier: 'T4', counts: [2, 5, 15, 40, 100] },
  { tier: 'T5', counts: [2, 5, 15, 40, 100] },
  { tier: 'T6', counts: [2, 15, 40, 100, 100] },
] as const;

/** 별 레벨별 합계 (원본 표 그대로) */
export const HERO_SHARD_TOTALS: readonly [number, number, number, number, number] = [
  10, 40, 115, 300, 600,
] as const;

/** 영웅 하나를 5성까지 올리는 데 드는 파편 총합 */
export const HERO_SHARD_GRAND_TOTAL = 1065;
