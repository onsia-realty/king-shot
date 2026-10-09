/**
 * 스펙업 로드맵. 캐릭터의 현재 장비 상태에서 "다음 1~2단계" 강화 후보를 전부 만들고,
 * 가중 성능 증가량 / 비용 으로 점수를 매겨 효율 좋은 순서로 추천한다.
 * 비용·성능 계산은 전부 src/data/spec-up.ts 함수를 그대로 쓴다.
 *
 * 출처: https://kshot-lab.com/tools/roadmap 의 공개 클라이언트 데이터
 *   (번들 07xwolxf4kixb.js 의 모듈 55201 추천 로직, 20239 슬롯 정의, 19404 저장 형식).
 * 수집일: 2026-10-09
 *
 * 원본과 다른 점: 원본은 왕국 번호로 세대를 정하지만 여기서는 세대를 직접 고른다.
 * 가중치는 원본 사이트 기준값이라 실제 전투 가치와 다를 수 있다.
 */

import { PACKAGE_GENERATIONS, type PackageGeneration } from './package-ref.ts';
import {
  calculateGovernorGear,
  calculateHeroGear,
  calculateJewel,
  GOVERNOR_GEAR_MAX_TIER,
  GOVERNOR_GEAR_TIERS,
  HERO_GEAR_MAX_LEVEL,
  heroGearStatPercent,
  JEWEL_MAX_LEVEL,
  MASTERY_AMPLIFY_RATE,
  MASTERY_MAX_LEVEL,
  type SpecUpItem,
} from './spec-up.ts';

/* ------------------------------------------------------------------ */
/* 슬롯 정의 (원본 모듈 20239)                                           */
/* ------------------------------------------------------------------ */

export type Troop = 'infantry' | 'archer' | 'cavalry';
export type HeroGearSlot = 'helmet' | 'gloves' | 'armor' | 'boots';
export type Stat = 'hp' | 'destruction' | 'attack' | 'defense';

export const TROOPS: readonly Troop[] = ['infantry', 'archer', 'cavalry'];
export const HERO_GEAR_SLOTS: readonly HeroGearSlot[] = ['helmet', 'gloves', 'armor', 'boots'];
export const TROOP_LABELS: Record<Troop, string> = { infantry: '보병', archer: '궁병', cavalry: '기병' };
export const HERO_GEAR_SLOT_LABELS: Record<HeroGearSlot, string> = {
  armor: '갑옷',
  gloves: '장갑',
  helmet: '헬멧',
  boots: '신발',
};
export const STAT_LABELS: Record<Stat, string> = {
  hp: '체력',
  destruction: '파괴력',
  attack: '공격력',
  defense: '방어력',
};
/** 병종마다 영주 장비 2부위, 보석 6칸 */
export const GOVERNOR_GEAR_SLOTS_PER_TROOP = 2;
export const JEWEL_SLOTS_PER_TROOP = 6;

/** 갑옷·장갑은 체력(원본 이름 DEFENSE_SLOTS), 헬멧·신발은 파괴력 */
const DEFENSE_SLOTS: readonly HeroGearSlot[] = ['armor', 'gloves'];

export interface HeroGearState {
  troop: Troop;
  slot: HeroGearSlot;
  /** 0~200 */
  level: number;
  /** 0~20 */
  mastery: number;
}

export interface GovernorGearState {
  troop: Troop;
  /** 1 또는 2 */
  slotIndex: number;
  /** -1(없음) ~ GOVERNOR_GEAR_MAX_TIER */
  tier: number;
}

export interface JewelState {
  troop: Troop;
  /** 칸별 레벨 0~22, 길이 6 */
  levels: number[];
}

export interface CharacterInfo {
  generation: PackageGeneration;
  heroGear: HeroGearState[];
  governorGear: GovernorGearState[];
  governorJewels: JewelState[];
}

export function createCharacter(
  generation: PackageGeneration,
  hero: (troop: Troop, slot: HeroGearSlot) => [level: number, mastery: number],
  governorTier: (troop: Troop, slotIndex: number) => number,
  jewelLevel: (troop: Troop, slotIndex: number) => number,
): CharacterInfo {
  return {
    generation,
    heroGear: TROOPS.flatMap((troop) =>
      HERO_GEAR_SLOTS.map((slot) => {
        const [level, mastery] = hero(troop, slot);
        return { troop, slot, level, mastery };
      }),
    ),
    governorGear: TROOPS.flatMap((troop) =>
      [1, 2].map((slotIndex) => ({ troop, slotIndex, tier: governorTier(troop, slotIndex) })),
    ),
    governorJewels: TROOPS.map((troop) => ({
      troop,
      levels: Array.from({ length: JEWEL_SLOTS_PER_TROOP }, (_, i) => jewelLevel(troop, i + 1)),
    })),
  };
}

/** 입력 전에 보여 줄 예시 캐릭터(순금 1/2/3 중반쯤). 실제 계정 데이터가 아니다. */
export const SAMPLE_CHARACTER: CharacterInfo = createCharacter(
  'gold_123',
  (troop, slot) => {
    const base = { infantry: 80, archer: 90, cavalry: 70 }[troop];
    const bump = { helmet: 0, gloves: 5, armor: 10, boots: -5 }[slot];
    return [base + bump, troop === 'archer' ? 6 : 4];
  },
  (troop) => ({ infantry: 22, archer: 24, cavalry: 21 })[troop],
  (troop, slotIndex) => ({ infantry: 10, archer: 11, cavalry: 9 })[troop] + (slotIndex % 2),
);

const clampInt = (v: unknown, min: number, max: number, fallback: number) => {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : fallback;
  return Math.min(max, Math.max(min, n));
};

/**
 * 저장된 JSON(또는 아무 값)을 범위 안의 CharacterInfo 로 맞춘다. 모양이 깨졌으면 null.
 * 원본 loadCharacterInfo 처럼 칸 수가 안 맞는 묶음은 기본값으로 채운다.
 */
export function normalizeCharacter(raw: unknown): CharacterInfo | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!PACKAGE_GENERATIONS.some((g) => g.key === r.generation)) return null;
  const find = <T extends { troop: unknown }>(list: unknown, pred: (x: T) => boolean): T | undefined =>
    Array.isArray(list) ? (list as T[]).find((x) => x && typeof x === 'object' && pred(x)) : undefined;

  return createCharacter(
    r.generation as PackageGeneration,
    (troop, slot) => {
      const g = find<HeroGearState>(r.heroGear, (x) => x.troop === troop && x.slot === slot);
      return [clampInt(g?.level, 0, HERO_GEAR_MAX_LEVEL, 0), clampInt(g?.mastery, 0, MASTERY_MAX_LEVEL, 0)];
    },
    (troop, slotIndex) => {
      const g = find<GovernorGearState>(r.governorGear, (x) => x.troop === troop && x.slotIndex === slotIndex);
      return clampInt(g?.tier, -1, GOVERNOR_GEAR_MAX_TIER, 0);
    },
    (troop, slotIndex) => {
      const j = find<JewelState>(r.governorJewels, (x) => x.troop === troop);
      return clampInt(Array.isArray(j?.levels) ? j.levels[slotIndex - 1] : 0, 0, JEWEL_MAX_LEVEL, 0);
    },
  );
}

/* ------------------------------------------------------------------ */
/* 가중치·우선순위 (원본 모듈 55201)                                      */
/* ------------------------------------------------------------------ */

export type RoadmapMode = 'all' | 'bear';
export type StatWeights = Readonly<Record<Stat, number>>;

/** 전체: 체력·파괴력 1.1, 공격·방어 1.0. 곰(곰 사냥): 궁병만 보고 체력·방어 0 */
export const ROADMAP_WEIGHTS: Record<RoadmapMode, StatWeights> = {
  all: { hp: 1.1, destruction: 1.1, defense: 1, attack: 1 },
  bear: { hp: 0, destruction: 1.1, defense: 0, attack: 1 },
};

/** 승급 레벨이 주는 보너스 스탯. 갑옷·헬멧 공→방→공, 장갑·신발 방→공→방 */
const PROMOTION_STATS: Record<'armor_helmet' | 'gloves_boots', Record<number, Stat>> = {
  armor_helmet: { 120: 'attack', 160: 'defense', 200: 'attack' },
  gloves_boots: { 120: 'defense', 160: 'attack', 200: 'defense' },
};
const GOVERNOR_GEAR_STATS: readonly Stat[] = ['attack', 'defense'];
const JEWEL_STATS: readonly Stat[] = ['hp', 'destruction'];

/** 100레벨 이후 후보를 끊는 지점(승급 직전·승급 레벨) */
const HERO_GEAR_BREAKPOINTS = [101, 119, 120, 139, 140, 159, 160, 179, 180, 199, 200];

/** 동점일 때 우선순위(작을수록 먼저). 보병방어 > 궁병공격 > 기병공격 > 궁병방어 > 보병공격 > 기병방어 */
const HERO_GEAR_PRIORITY: Record<string, number> = {
  infantry_defense: 1,
  archer_attack: 2,
  cavalry_attack: 3,
  archer_defense: 4,
  infantry_attack: 5,
  cavalry_defense: 6,
};
const TROOP_PRIORITY: Record<Troop, number> = { infantry: 10, archer: 11, cavalry: 12 };

const sumWeights = (stats: readonly Stat[], w: StatWeights) => stats.reduce((s, x) => s + w[x], 0);
const slotStat = (slot: HeroGearSlot): Stat => (DEFENSE_SLOTS.includes(slot) ? 'hp' : 'destruction');

function promotionStats(slot: HeroGearSlot, from: number, to: number): Stat[] {
  const map = slot === 'armor' || slot === 'helmet' ? PROMOTION_STATS.armor_helmet : PROMOTION_STATS.gloves_boots;
  const set = new Set<Stat>();
  for (const lv of [120, 160, 200]) if (lv > from && lv <= to) set.add(map[lv]);
  return [...set];
}

function heroPriority(troop: Troop, slot: HeroGearSlot): number {
  return HERO_GEAR_PRIORITY[`${troop}_${DEFENSE_SLOTS.includes(slot) ? 'defense' : 'attack'}`] ?? 99;
}

/** 100 미만은 100까지 한 번에, 그 뒤는 끊는 지점 기준 다음 2구간 */
function heroGearTargets(level: number): [number, number][] {
  if (level < 100) return [[level, 100]];
  const out: [number, number][] = [];
  let cursor = level;
  for (let i = 0; i < 2; i++) {
    const next = HERO_GEAR_BREAKPOINTS.find((b) => b > cursor);
    if (next === undefined) break;
    out.push([cursor, next]);
    cursor = next;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 추천                                                                 */
/* ------------------------------------------------------------------ */

export type RoadmapCategory = 'hero_gear' | 'hero_mastery' | 'governor_gear' | 'jewel';

export const ROADMAP_CATEGORY_LABELS: Record<RoadmapCategory, string> = {
  hero_gear: '영웅장비',
  hero_mastery: '마스터리',
  governor_gear: '영주장비',
  jewel: '영주보석',
};

export interface RoadmapItem {
  rank: number;
  category: RoadmapCategory;
  troop: Troop;
  slotLabel: string;
  currentState: string;
  nextTarget: string;
  /** 가중치 없는 성능 증가 %p (승급 보너스 포함) */
  rawStatGain: number;
  affectedStats: Stat[];
  weightedStatGain: number;
  totalCostKRW: number;
  /** weightedStatGain / totalCostKRW. 클수록 효율 좋음 */
  efficiencyScore: number;
  costPer1Percent: number;
  resources: { name: string; amount: number }[];
  priority: number;
}

export const ROADMAP_LIMIT = 30;

function mergeResources(items: readonly SpecUpItem[]): { name: string; amount: number }[] {
  const m = new Map<string, number>();
  for (const it of items) m.set(it.name, (m.get(it.name) ?? 0) + it.amount);
  return [...m].map(([name, amount]) => ({ name, amount }));
}

const tierLabel = (tier: number) => (tier < 0 ? '없음' : GOVERNOR_GEAR_TIERS[tier] ?? `Tier ${tier}`);

/** 현재 상태에서 다음 1~2단계 후보를 모아 효율 순 상위 30개를 돌려준다. */
export function recommendRoadmap(character: CharacterInfo, mode: RoadmapMode = 'all'): RoadmapItem[] {
  const w = ROADMAP_WEIGHTS[mode];
  const keep = (x: { troop: Troop }) => mode !== 'bear' || x.troop === 'archer';
  const generation = character.generation;
  const out: Omit<RoadmapItem, 'rank'>[] = [];

  // 영웅 장비 레벨
  for (const g of character.heroGear.filter(keep)) {
    const level = clampInt(g.level, 0, HERO_GEAR_MAX_LEVEL, 0);
    if (level >= HERO_GEAR_MAX_LEVEL) continue;
    for (const [from, to] of heroGearTargets(level)) {
      const r = calculateHeroGear({ generation, fromLevel: from, toLevel: to, masteryFrom: 0, masteryTo: 0 });
      const cost = r.leveling.costKRW;
      if (cost <= 0) continue;
      const statGain = r.levelingSteps.reduce((s, x) => s + x.statGain, 0);
      const bonus = r.levelingSteps.reduce((s, x) => s + x.promotionBonus, 0);
      const raw = statGain + bonus;
      if (raw <= 0) continue;
      const promo = promotionStats(g.slot, from, to);
      const promoWeight = promo.length === 0 ? 1 : sumWeights(promo, w) / promo.length;
      const weighted = statGain * w[slotStat(g.slot)] + bonus * promoWeight;
      if (weighted <= 0) continue;
      out.push({
        category: 'hero_gear',
        troop: g.troop,
        slotLabel: HERO_GEAR_SLOT_LABELS[g.slot],
        currentState: `Lv.${from}`,
        nextTarget: `Lv.${to}`,
        rawStatGain: raw,
        affectedStats: bonus > 0 ? [slotStat(g.slot), ...promo] : [slotStat(g.slot)],
        weightedStatGain: weighted,
        totalCostKRW: cost,
        efficiencyScore: weighted / cost,
        costPer1Percent: cost / raw,
        resources: mergeResources(r.levelingSteps.flatMap((s) => s.items)),
        priority: heroPriority(g.troop, g.slot),
      });
    }
  }

  // 마스터리: 장비 레벨 0이면 못 올린다. 단계당 증가량은 현재 장비 레벨 스탯의 10%
  for (const g of character.heroGear.filter(keep)) {
    const level = clampInt(g.level, 0, HERO_GEAR_MAX_LEVEL, 0);
    const mastery = clampInt(g.mastery, 0, MASTERY_MAX_LEVEL, 0);
    const slotWeight = w[slotStat(g.slot)];
    if (mastery >= MASTERY_MAX_LEVEL || level <= 0 || slotWeight <= 0) continue;
    const raw = heroGearStatPercent(level) * MASTERY_AMPLIFY_RATE;
    for (let from = mastery; from < Math.min(mastery + 2, MASTERY_MAX_LEVEL); from++) {
      const r = calculateHeroGear({ generation, fromLevel: level, toLevel: level, masteryFrom: from, masteryTo: from + 1 });
      const cost = r.mastery.costKRW;
      if (cost <= 0 || raw <= 0) continue;
      out.push({
        category: 'hero_mastery',
        troop: g.troop,
        slotLabel: HERO_GEAR_SLOT_LABELS[g.slot],
        currentState: `M.${from}`,
        nextTarget: `M.${from + 1}`,
        rawStatGain: raw,
        affectedStats: [slotStat(g.slot)],
        weightedStatGain: raw * slotWeight,
        totalCostKRW: cost,
        efficiencyScore: (raw * slotWeight) / cost,
        costPer1Percent: cost / raw,
        resources: mergeResources(r.masterySteps.flatMap((s) => s.items)),
        priority: heroPriority(g.troop, g.slot),
      });
    }
  }

  // 영주 장비: 공격+방어 평균 가중치
  const govWeight = sumWeights(GOVERNOR_GEAR_STATS, w) / GOVERNOR_GEAR_STATS.length;
  if (govWeight > 0) {
    for (const g of character.governorGear.filter(keep)) {
      const tier = clampInt(g.tier, -1, GOVERNOR_GEAR_MAX_TIER, 0);
      for (let from = tier; from < Math.min(tier + 2, GOVERNOR_GEAR_MAX_TIER); from++) {
        const r = calculateGovernorGear({ generation, fromTier: from, toTier: from + 1 });
        const cost = r.total.costKRW;
        const raw = r.total.statGain;
        if (cost <= 0 || raw <= 0) continue;
        out.push({
          category: 'governor_gear',
          troop: g.troop,
          slotLabel: `슬롯${g.slotIndex}`,
          currentState: tierLabel(from),
          nextTarget: tierLabel(from + 1),
          rawStatGain: raw,
          affectedStats: [...GOVERNOR_GEAR_STATS],
          weightedStatGain: raw * govWeight,
          totalCostKRW: cost,
          efficiencyScore: (raw * govWeight) / cost,
          costPer1Percent: cost / raw,
          resources: mergeResources(r.steps.flatMap((s) => s.items)),
          priority: TROOP_PRIORITY[g.troop],
        });
      }
    }
  }

  // 영주 보석: 체력+파괴력 평균 가중치, 칸마다 따로
  const jewelWeight = sumWeights(JEWEL_STATS, w) / JEWEL_STATS.length;
  if (jewelWeight > 0) {
    for (const j of character.governorJewels.filter(keep)) {
      j.levels.forEach((lv, i) => {
        const level = clampInt(lv, 0, JEWEL_MAX_LEVEL, 0);
        for (let from = level; from < Math.min(level + 2, JEWEL_MAX_LEVEL); from++) {
          const r = calculateJewel({ generation, fromLevel: from, toLevel: from + 1 });
          const cost = r.total.costKRW;
          const raw = r.total.statGain;
          if (cost <= 0 || raw <= 0) continue;
          out.push({
            category: 'jewel',
            troop: j.troop,
            slotLabel: `${i + 1}칸`,
            currentState: `Lv.${from}`,
            nextTarget: `Lv.${from + 1}`,
            rawStatGain: raw,
            affectedStats: [...JEWEL_STATS],
            weightedStatGain: raw * jewelWeight,
            totalCostKRW: cost,
            efficiencyScore: (raw * jewelWeight) / cost,
            costPer1Percent: cost / raw,
            resources: mergeResources(r.steps.flatMap((s) => s.items)),
            priority: TROOP_PRIORITY[j.troop],
          });
        }
      });
    }
  }

  // 효율 내림차순, 사실상 같으면 우선순위 오름차순. 그래도 같으면 넣은 순서(sort 는 안정 정렬)
  out.sort((a, b) => {
    const d = b.efficiencyScore - a.efficiencyScore;
    return Math.abs(d) > 1e-12 ? d : a.priority - b.priority;
  });
  return out.slice(0, ROADMAP_LIMIT).map((x, i) => ({ ...x, rank: i + 1 }));
}
