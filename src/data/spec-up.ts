/**
 * 스펙업 계산기 데이터와 계산 함수. 영웅 장비(레벨·마스터리), 영주 장비(티어), 영주 보석(레벨)을
 * 올릴 때 드는 재료를 패키지 기준 원화로 환산하고, 성능이 몇 % 오르는지 같이 계산한다.
 * 계산 함수는 전부 순수 함수라 스펙업 로드맵이 그대로 import해 쓴다.
 *
 * 출처: https://kshot-lab.com/tools/progress 의 공개 클라이언트 데이터
 *   (번들 06lhtbnzcdh9_.js 의 모듈 60035 데이터, 84432 영주 장비 성능표, 18023/11341/12830 계산 함수).
 * 수집일: 2026-10-09
 *
 * 단가는 src/data/package-ref.ts 의 기준 패키지(7,500원) 수량에서 나온다. 그래서 세대를
 * 바꾸면 같은 재료라도 원화 환산값이 달라진다.
 * 주의: 순금 6/7/8·진급·9/10 세대는 패키지 구성이 예측치라 비용도 예측치다.
 * 성능 % 는 원본 사이트 표기를 따른 원정 효과 기준이다. 게임 내 표기와 다르면 게임 쪽을 따른다.
 */

import {
  BASE_PACKAGE_PRICE_KRW,
  getPackageGeneration,
  unitPrice,
  type PackageGeneration,
} from './package-ref.ts';

/* ------------------------------------------------------------------ */
/* 공통 타입                                                            */
/* ------------------------------------------------------------------ */

export type SpecUpItemKey =
  | 'exp_parts'
  | 'mithril'
  | 'mythic_gear'
  | 'hammer'
  | 'satin'
  | 'thread'
  | 'sketch'
  | 'jewel_manual'
  | 'jewel_blueprint';

export interface SpecUpItem {
  key: SpecUpItemKey;
  name: string;
  amount: number;
  unitPriceKRW: number;
  costKRW: number;
}

/** 계산 결과의 한 줄(구간 또는 한 단계). 세 계산기가 같은 모양을 쓴다. */
export interface SpecUpStep {
  label: string;
  from: number;
  to: number;
  costKRW: number;
  /** 이 단계에서 오르는 성능 %p (승급 보너스 제외) */
  statGain: number;
  /** 영웅 장비 승급 보너스 %p. 나머지는 0 */
  promotionBonus: number;
  /** 단계가 끝난 뒤의 누적 성능 % */
  statTo: number;
  /** (statGain + promotionBonus) 1%p 당 원화. 성능 증가가 0이면 0 */
  costPer1Percent: number;
  items: SpecUpItem[];
  /** 영웅 장비 승급 레벨(101/120/140/160/180/200) 단계 */
  milestone?: boolean;
}

export interface SpecUpTotals {
  costKRW: number;
  /** 승급 보너스 포함 총 성능 증가 %p */
  statGain: number;
  costPer1Percent: number;
}

function totalsOf(steps: readonly SpecUpStep[]): SpecUpTotals {
  const costKRW = steps.reduce((s, x) => s + x.costKRW, 0);
  const statGain = steps.reduce((s, x) => s + x.statGain + x.promotionBonus, 0);
  return { costKRW, statGain, costPer1Percent: statGain > 0 ? costKRW / statGain : 0 };
}

function item(key: SpecUpItemKey, name: string, amount: number, unitPriceKRW: number): SpecUpItem {
  return { key, name, amount, unitPriceKRW, costKRW: amount * unitPriceKRW };
}

/** 1%p 당 비용 등급. 원본 배지 기준(5천/1.5만/5만원)을 그대로 쓴다. */
export type CostGrade = 'good' | 'fair' | 'poor' | 'bad';

export function costGrade(costPer1Percent: number): CostGrade {
  if (costPer1Percent <= 5000) return 'good';
  if (costPer1Percent <= 15000) return 'fair';
  if (costPer1Percent <= 50000) return 'poor';
  return 'bad';
}

/* ------------------------------------------------------------------ */
/* 영웅 장비                                                            */
/* ------------------------------------------------------------------ */

export const HERO_GEAR_MAX_LEVEL = 200;
export const MASTERY_MAX_LEVEL = 20;
/** 미스릴은 패키지 세대와 상관없이 개당 7,500원으로 본다(원본 MITHRIL_PRICE_KRW). */
export const MITHRIL_PRICE_KRW = 7500;
/** 마스터리 1단계가 장비 스탯에 더하는 비율 */
export const MASTERY_AMPLIFY_RATE = 0.1;

/** 레벨 n 으로 올리는 데 드는 영웅장비 EXP. 인덱스 = 레벨. 승급 레벨은 0이다. */
const HERO_GEAR_EXP: readonly number[] = [
  0, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115,
  120, 125, 130, 135, 140, 145, 150, 160, 170, 180, 190, 200, 210, 220, 230, 240, 250, 270, 290,
  310, 330, 350, 370, 390, 410, 430, 450, 470, 490, 510, 530, 550, 570, 590, 610, 630, 650, 680,
  710, 740, 770, 800, 830, 860, 890, 920, 950, 990, 1030, 1070, 1110, 1150, 1190, 1230, 1270, 1310,
  1350, 1400, 1450, 1500, 1550, 1600, 1650, 1700, 1750, 1800, 1850, 1900, 1950, 2000, 2050, 2100,
  2150, 2200, 2250, 2300, 2350, 2400, 0, 2500, 2550, 2600, 2650, 2700, 2750, 2800, 2850, 2900,
  2950, 3000, 3050, 3100, 3150, 3200, 3250, 3300, 3350, 0, 3500, 3550, 3600, 3650, 3700, 3750,
  3800, 3850, 3900, 3950, 4000, 4050, 4100, 4150, 4200, 4250, 4300, 4350, 4400, 0, 4450, 4500,
  4550, 4600, 4650, 4700, 4750, 4800, 4850, 4900, 4950, 5000, 5050, 5100, 5150, 5200, 5250, 5300,
  5350, 0, 5500, 5600, 5700, 5800, 5900, 6000, 6100, 6200, 6300, 6400, 6500, 6600, 6700, 6800,
  6900, 7000, 7100, 7200, 7300, 0, 7500, 7600, 7700, 7800, 7900, 8000, 8100, 8200, 8300, 8400,
  8500, 8600, 8700, 8800, 8900, 9000, 9100, 9200, 9300, 0,
];

export interface HeroGearPromotion {
  level: number;
  mithril: number;
  mythicGear: number;
  /** 원정 효과 승급 보너스 %p */
  bonus: number;
}

/** 승급 레벨. EXP 대신 미스릴·신화 장비를 쓴다. */
export const HERO_GEAR_PROMOTIONS: readonly HeroGearPromotion[] = [
  { level: 101, mithril: 0, mythicGear: 2, bonus: 0 },
  { level: 120, mithril: 10, mythicGear: 3, bonus: 20 },
  { level: 140, mithril: 20, mythicGear: 5, bonus: 0 },
  { level: 160, mithril: 30, mythicGear: 5, bonus: 30 },
  { level: 180, mithril: 40, mythicGear: 10, bonus: 0 },
  { level: 200, mithril: 50, mythicGear: 10, bonus: 50 },
];

/** 마스터리 n→n+1 에 드는 [망치, 신화 장비]. 인덱스 = 시작 단계. */
const MASTERY_COSTS: readonly (readonly [number, number])[] = [
  [10, 0], [20, 0], [30, 0], [40, 0], [50, 0], [60, 0], [70, 0], [80, 0], [90, 0], [100, 0],
  [110, 1], [120, 2], [130, 3], [140, 4], [150, 5], [160, 6], [170, 7], [180, 8], [190, 9], [200, 10],
];

/** 영웅 장비 레벨별 스탯 % (승급 보너스 제외) */
export function heroGearStatPercent(level: number): number {
  return 15 + 0.35 * level;
}

export interface HeroGearUnitPrices {
  expKRW: number;
  hammerKRW: number;
  mythicGearKRW: number;
  mithrilKRW: number;
}

export function heroGearUnitPrices(generation: PackageGeneration): HeroGearUnitPrices {
  const boxQty = getPackageGeneration(generation).quantities.hero_gear_box || 1;
  return {
    expKRW: unitPrice(generation, 'exp_parts'),
    hammerKRW: unitPrice(generation, 'hammer'),
    // 신화 장비 1개 = 영웅 장비 상자 100개. 원본 식 그대로 둔다(순금 1/2/3 에서 부동소수 때문에 62,501원).
    mythicGearKRW: Math.ceil((100 / boxQty) * BASE_PACKAGE_PRICE_KRW),
    mithrilKRW: MITHRIL_PRICE_KRW,
  };
}

export interface HeroGearInput {
  generation: PackageGeneration;
  /** 0~200, fromLevel <= toLevel */
  fromLevel: number;
  toLevel: number;
  /** 0~20, masteryFrom <= masteryTo */
  masteryFrom: number;
  masteryTo: number;
}

export interface HeroGearResult {
  prices: HeroGearUnitPrices;
  /** EXP 구간과 승급 단계. 승급 레벨을 경계로 구간을 끊는다. */
  levelingSteps: SpecUpStep[];
  masterySteps: SpecUpStep[];
  leveling: SpecUpTotals;
  mastery: SpecUpTotals;
  total: SpecUpTotals;
}

function levelingSegment(from: number, to: number, expKRW: number): SpecUpStep {
  let exp = 0;
  for (let lv = from + 1; lv <= to; lv++) exp += HERO_GEAR_EXP[lv];
  const costKRW = exp * expKRW;
  const statGain = heroGearStatPercent(to) - heroGearStatPercent(from);
  return {
    label: `Lv.${from} → ${to}`,
    from,
    to,
    costKRW,
    statGain,
    promotionBonus: 0,
    statTo: heroGearStatPercent(to),
    costPer1Percent: statGain > 0 ? costKRW / statGain : 0,
    items: [item('exp_parts', '영웅장비 EXP', exp, expKRW)],
  };
}

function promotionStep(p: HeroGearPromotion, prices: HeroGearUnitPrices): SpecUpStep {
  const items: SpecUpItem[] = [];
  if (p.mithril > 0) items.push(item('mithril', '미스릴', p.mithril, prices.mithrilKRW));
  if (p.mythicGear > 0) items.push(item('mythic_gear', '신화 장비', p.mythicGear, prices.mythicGearKRW));
  const costKRW = items.reduce((s, x) => s + x.costKRW, 0);
  const statGain = heroGearStatPercent(p.level) - heroGearStatPercent(p.level - 1);
  const gain = statGain + p.bonus;
  return {
    label: `Lv.${p.level} 승급`,
    from: p.level - 1,
    to: p.level,
    costKRW,
    statGain,
    promotionBonus: p.bonus,
    statTo: heroGearStatPercent(p.level),
    costPer1Percent: gain > 0 ? costKRW / gain : 0,
    items,
    milestone: true,
  };
}

/**
 * 영웅 장비 한 부위의 레벨·마스터리 비용과 성능 증가.
 * 마스터리 1단계 증가량은 목표 레벨 장비 스탯의 10% 라서, 레벨을 같이 올리면 마스터리 효율도 오른다.
 */
export function calculateHeroGear(input: HeroGearInput): HeroGearResult {
  const { generation, fromLevel, toLevel, masteryFrom, masteryTo } = input;
  const prices = heroGearUnitPrices(generation);

  const levelingSteps: SpecUpStep[] = [];
  let cursor = fromLevel;
  for (const p of HERO_GEAR_PROMOTIONS) {
    if (p.level <= fromLevel || p.level > toLevel) continue;
    if (cursor < p.level - 1) levelingSteps.push(levelingSegment(cursor, p.level - 1, prices.expKRW));
    levelingSteps.push(promotionStep(p, prices));
    cursor = p.level;
  }
  if (cursor < toLevel) levelingSteps.push(levelingSegment(cursor, toLevel, prices.expKRW));

  const perMastery = MASTERY_AMPLIFY_RATE * heroGearStatPercent(toLevel);
  const masterySteps: SpecUpStep[] = [];
  for (let m = masteryFrom; m < masteryTo; m++) {
    const [hammers, mythic] = MASTERY_COSTS[m];
    const items = [item('hammer', '망치', hammers, prices.hammerKRW)];
    if (mythic > 0) items.push(item('mythic_gear', '신화 장비', mythic, prices.mythicGearKRW));
    const costKRW = items.reduce((s, x) => s + x.costKRW, 0);
    masterySteps.push({
      label: `마스터리 ${m} → ${m + 1}`,
      from: m,
      to: m + 1,
      costKRW,
      statGain: perMastery,
      promotionBonus: 0,
      statTo: (m + 1) * perMastery,
      costPer1Percent: perMastery > 0 ? costKRW / perMastery : 0,
      items,
    });
  }

  return {
    prices,
    levelingSteps,
    masterySteps,
    leveling: totalsOf(levelingSteps),
    mastery: totalsOf(masterySteps),
    total: totalsOf([...levelingSteps, ...masterySteps]),
  };
}

/* ------------------------------------------------------------------ */
/* 영주 장비                                                            */
/* ------------------------------------------------------------------ */

/** 티어 이름과 그 티어로 올리는 데 드는 [비단, 금사, 스케치]. 인덱스 = 티어 번호(0=고급). */
const GOVERNOR_GEAR_DATA: readonly (readonly [string, number, number, number])[] = [
  ['고급', 1500, 15, 0],
  ['고급 ★1', 3800, 40, 0],
  ['레어', 7000, 70, 0],
  ['레어 ★1', 9700, 95, 0],
  ['레어 ★2', 1000, 10, 45],
  ['레어 ★3', 1000, 10, 50],
  ['에픽', 1500, 15, 60],
  ['에픽 ★1', 1500, 15, 70],
  ['에픽 ★2', 6500, 65, 40],
  ['에픽 ★3', 8000, 80, 50],
  ['에픽 T1', 10000, 95, 60],
  ['에픽 T1 ★1', 11000, 110, 70],
  ['에픽 T1 ★2', 13000, 130, 85],
  ['에픽 T1 ★3', 15000, 160, 100],
  ['레전드', 22000, 220, 40],
  ['레전드 ★1', 23000, 230, 40],
  ['레전드 ★2', 25000, 250, 45],
  ['레전드 ★3', 26000, 260, 45],
  ['레전드 T1', 28000, 280, 45],
  ['레전드 T1 ★1', 30000, 300, 55],
  ['레전드 T1 ★2', 32000, 320, 55],
  ['레전드 T1 ★3', 35000, 340, 55],
  ['레전드 T2', 38000, 360, 55],
  ['레전드 T2 ★1', 43000, 430, 75],
  ['레전드 T2 ★2', 45000, 460, 80],
  ['레전드 T2 ★3', 48000, 500, 85],
  ['레전드 T3', 60000, 600, 120],
  ['레전드 T3 ★1', 70000, 700, 140],
  ['레전드 T3 ★2', 80000, 800, 160],
  ['레전드 T3 ★3', 90000, 900, 180],
  ['신화', 108000, 1080, 220],
  ['신화 ★1', 114000, 1140, 230],
  ['신화 ★2', 121000, 1210, 240],
  ['신화 ★3', 128000, 1280, 250],
  ['신화 T1', 154000, 1540, 300],
  ['신화 T1 ★1', 163000, 1630, 320],
  ['신화 T1 ★2', 173000, 1730, 340],
  ['신화 T1 ★3', 183000, 1830, 360],
  ['신화 T2', 220000, 2200, 430],
  ['신화 T2 ★1', 233000, 2330, 460],
  ['신화 T2 ★2', 247000, 2470, 490],
  ['신화 T2 ★3', 264000, 2640, 520],
  ['신화 T3', 306000, 3060, 610],
  ['신화 T3 ★1', 323000, 3230, 650],
  ['신화 T3 ★2', 340000, 3400, 690],
  ['신화 T3 ★3', 357000, 3570, 730],
  ['신화 T4', 412000, 4120, 840],
  ['신화 T4 ★1', 433000, 4330, 890],
  ['신화 T4 ★2', 454000, 4540, 940],
  ['신화 T4 ★3', 475000, 4750, 990],
  ['신화 T5', 479000, 4790, 1120],
  ['신화 T5 ★1', 493000, 4930, 1180],
  ['신화 T5 ★2', 507000, 5070, 1240],
  ['신화 T5 ★3', 521000, 5210, 1300],
  ['신화 T6', 548000, 5480, 1450],
  ['신화 T6 ★1', 565000, 5650, 1520],
  ['신화 T6 ★2', 582000, 5820, 1590],
  ['신화 T6 ★3', 599000, 5990, 1660],
];

/** 티어 이름. 인덱스 = 티어 번호. 계산 입력의 -1 은 "장비 없음"이다. */
export const GOVERNOR_GEAR_TIERS: readonly string[] = GOVERNOR_GEAR_DATA.map((r) => r[0]);
export const GOVERNOR_GEAR_MAX_TIER = GOVERNOR_GEAR_DATA.length - 1;

/**
 * 성능표. 티어 18(레전드 T1)부터 실측값이 있고, 그 앞은 2.5씩 빼고 뒤(신화 T2★2~)는 2.5씩 더한다.
 * 원본 사이트도 이렇게 외삽한다.
 */
const GOVERNOR_GEAR_PERFORMANCE: readonly number[] = [
  66.98, 69.53, 72.08, 74.63, 77.18, 79.73, 82.28, 84.83, 87.38, 89.93, 92.48, 95.03, 97.5, 100,
  102.5, 105, 107.5, 110, 112.5, 115, 117.5, 120,
];
const PERFORMANCE_TABLE_OFFSET = 18;

function performanceAt(tier: number): number {
  const t = tier - PERFORMANCE_TABLE_OFFSET;
  const table = GOVERNOR_GEAR_PERFORMANCE;
  if (t >= 0 && t < table.length) return table[t];
  if (t >= table.length) return table[table.length - 1] + (t - table.length + 1) * 2.5;
  return table[0] + 2.5 * t;
}

/** 영주 장비 한 부위가 그 티어일 때의 누적 성능 % (원정 효과 ×2 반영) */
export function governorGearPerformance(tier: number): number {
  return 2 * performanceAt(tier);
}

/** 그 티어로 올라갈 때 오르는 성능 %p. 티어 0 은 "없음"에서 고급으로 가는 값이다. */
function governorGearGain(tier: number): number {
  return 2 * (tier <= 0 ? performanceAt(0) : performanceAt(tier) - performanceAt(tier - 1));
}

export interface GovernorGearUnitPrices {
  satinKRW: number;
  threadKRW: number;
  sketchKRW: number;
}

/** 비단·금사는 원본이 세트 패키지 반분(3,750원) 기준이라 기준 단가의 절반으로 본다. */
export function governorGearUnitPrices(generation: PackageGeneration): GovernorGearUnitPrices {
  return {
    satinKRW: unitPrice(generation, 'satin') / 2,
    threadKRW: unitPrice(generation, 'thread') / 2,
    sketchKRW: unitPrice(generation, 'sketch'),
  };
}

export interface GovernorGearInput {
  generation: PackageGeneration;
  /** -1(없음) ~ GOVERNOR_GEAR_MAX_TIER, fromTier <= toTier */
  fromTier: number;
  toTier: number;
}

export interface GovernorGearResult {
  prices: GovernorGearUnitPrices;
  steps: SpecUpStep[];
  total: SpecUpTotals;
}

export function calculateGovernorGear(input: GovernorGearInput): GovernorGearResult {
  const { generation, fromTier, toTier } = input;
  const prices = governorGearUnitPrices(generation);
  const steps: SpecUpStep[] = [];
  for (let tier = fromTier + 1; tier <= toTier; tier++) {
    const [name, satin, thread, sketch] = GOVERNOR_GEAR_DATA[tier];
    const items: SpecUpItem[] = [];
    if (satin > 0) items.push(item('satin', '비단', satin, prices.satinKRW));
    if (thread > 0) items.push(item('thread', '금사', thread, prices.threadKRW));
    if (sketch > 0) items.push(item('sketch', '스케치', sketch, prices.sketchKRW));
    const costKRW = items.reduce((s, x) => s + x.costKRW, 0);
    const statGain = governorGearGain(tier);
    steps.push({
      label: name,
      from: tier - 1,
      to: tier,
      costKRW,
      statGain,
      promotionBonus: 0,
      statTo: governorGearPerformance(tier),
      costPer1Percent: statGain > 0 ? costKRW / statGain : 0,
      items,
    });
  }
  return { prices, steps, total: totalsOf(steps) };
}

/* ------------------------------------------------------------------ */
/* 영주 보석                                                            */
/* ------------------------------------------------------------------ */

export const JEWEL_MAX_LEVEL = 22;

/** 레벨 n→n+1 의 [보석 매뉴얼, 보석 도면, 도달 레벨 속성 %]. 인덱스 = 시작 레벨. */
const JEWEL_DATA: readonly (readonly [number, number, number])[] = [
  [5, 5, 9], [40, 15, 12], [60, 40, 16], [80, 100, 19], [100, 200, 25], [120, 300, 30],
  [140, 400, 35], [200, 400, 40], [300, 400, 45], [420, 420, 50], [560, 420, 55], [580, 600, 59],
  [610, 780, 63], [645, 960, 67], [685, 1140, 71], [730, 1320, 75], [780, 1500, 79],
  [835, 1680, 83], [895, 1860, 87], [960, 2040, 91], [1030, 2220, 95], [1105, 2400, 99],
];

/** 보석 레벨별 누적 성능 % (원정 효과 ×2 반영). 0레벨은 0 */
export function jewelPerformance(level: number): number {
  return level <= 0 ? 0 : 2 * JEWEL_DATA[level - 1][2];
}

export interface JewelInput {
  generation: PackageGeneration;
  /** 0~22, fromLevel <= toLevel */
  fromLevel: number;
  toLevel: number;
}

export interface JewelResult {
  /** 매뉴얼·도면 공통 단가. 패키지 표의 "보석 도면 및 매뉴얼" 수량 기준 */
  unitPriceKRW: number;
  steps: SpecUpStep[];
  total: SpecUpTotals;
}

export function calculateJewel(input: JewelInput): JewelResult {
  const { generation, fromLevel, toLevel } = input;
  const unit = unitPrice(generation, 'blueprint');
  const steps: SpecUpStep[] = [];
  for (let lv = fromLevel; lv < toLevel; lv++) {
    const [manual, blueprint] = JEWEL_DATA[lv];
    const items: SpecUpItem[] = [];
    if (manual > 0) items.push(item('jewel_manual', '보석 매뉴얼', manual, unit));
    if (blueprint > 0) items.push(item('jewel_blueprint', '보석 도면', blueprint, unit));
    const costKRW = items.reduce((s, x) => s + x.costKRW, 0);
    const statGain = jewelPerformance(lv + 1) - jewelPerformance(lv);
    steps.push({
      label: `Lv.${lv} → ${lv + 1}`,
      from: lv,
      to: lv + 1,
      costKRW,
      statGain,
      promotionBonus: 0,
      statTo: jewelPerformance(lv + 1),
      costPer1Percent: statGain > 0 ? costKRW / statGain : 0,
      items,
    });
  }
  return { unitPriceKRW: unit, steps, total: totalsOf(steps) };
}
