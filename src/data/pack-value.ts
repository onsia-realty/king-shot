/**
 * 패키지 계산기 데이터와 순수 계산 함수. 탭 세 개(효율 랭킹, 토큰 최적화, 바람을 쫓는 여행)가 모두 여기서 계산한다.
 *
 * 출처: https://kshot-lab.com/tools/pack-value 의 공개 클라이언트 데이터(번들 모듈 24505).
 * 수집일: 2026-10-09
 *
 * 한계: 이벤트 패키지 구성·가격·토큰 수는 이벤트마다 바뀐다. 자동 갱신이 없어서
 * 새 이벤트가 열리면 이 파일의 표를 손으로 고쳐야 한다. 지금 값은 스킨 이벤트(순금 4/5세대 기준)다.
 *
 * 아이템 단가는 package-ref.ts 의 unitPrice 를 그대로 쓴다(원본과 같은 공식이라 수치가 일치한다).
 * 가속만 기준표에 없어서 원본 상수(7,500원 = 119시간)를 따로 둔다.
 */
import { BASE_PACKAGE_PRICE_KRW, unitPrice } from './package-ref.ts';
import type { PackageGeneration, PackageItem } from './package-ref.ts';

/* ───────────────────────── 1. 효율 랭킹 ───────────────────────── */

/** 가속 1시간의 원화 단가. 원본 주석: 7,500원 = 119시간(17×7). */
export const SPEEDUP_HOURS_PER_BASE = 119;
export const SPEEDUP_UNIT_PRICE_KRW = BASE_PACKAGE_PRICE_KRW / SPEEDUP_HOURS_PER_BASE;

export type EventItemKey = PackageItem | 'speedup_hours';

export interface EventItem {
  itemKey: EventItemKey;
  name: string;
  amount: number;
}

export interface EventPackage {
  id: string;
  eventName: string;
  packageName: string;
  priceKRW: number;
  /** null = 구매 제한 없음 */
  maxPurchases: number | null;
  stage: PackageGeneration;
  tokens: number;
  items: readonly EventItem[];
}

const it = (itemKey: EventItemKey, name: string, amount: number): EventItem => ({ itemKey, name, amount });

/** 특별아이템은 원본처럼 망치 개수로 환산해 망치 단가를 매긴다. */
export const EVENT_PACKAGES: readonly EventPackage[] = [
  {
    id: 'skin_45_7500', eventName: '스킨 이벤트', packageName: '7,500원', priceKRW: 7500, maxPurchases: null, stage: 'gold_45', tokens: 80,
    items: [it('gold', '순금', 40), it('hammer', '망치', 18), it('hammer', '특별아이템 (망치 환산)', 2)],
  },
  {
    id: 'skin_45_15000', eventName: '스킨 이벤트', packageName: '15,000원', priceKRW: 15000, maxPurchases: null, stage: 'gold_45', tokens: 120,
    items: [it('gold', '순금', 80), it('hammer', '망치', 36), it('hammer', '특별아이템 (망치 환산)', 3.5)],
  },
  {
    id: 'skin_45_30000', eventName: '스킨 이벤트', packageName: '30,000원', priceKRW: 30000, maxPurchases: null, stage: 'gold_45', tokens: 200,
    items: [it('gold', '순금', 130), it('hammer', '망치', 60), it('hammer', '특별아이템 (망치 환산)', 5), it('speedup_hours', '가속(시간)', 60)],
  },
  {
    id: 'skin_45_79000', eventName: '스킨 이벤트', packageName: '79,000원', priceKRW: 79000, maxPurchases: null, stage: 'gold_45', tokens: 500,
    items: [it('gold', '순금', 260), it('hammer', '망치', 120), it('hammer', '특별아이템 (망치 환산)', 12), it('speedup_hours', '가속(시간)', 150)],
  },
  {
    id: 'skin_45_150000', eventName: '스킨 이벤트', packageName: '150,000원', priceKRW: 150000, maxPurchases: null, stage: 'gold_45', tokens: 1000,
    items: [it('gold', '순금', 520), it('hammer', '망치', 240), it('hammer', '특별아이템 (망치 환산)', 20), it('speedup_hours', '가속(시간)', 300)],
  },
  {
    id: 'skin_45_150000_special', eventName: '스킨 이벤트', packageName: '150,000원 특별', priceKRW: 150000, maxPurchases: 3, stage: 'gold_45', tokens: 800,
    items: [it('hero_gear_box', '영웅 장비 상자', 150), it('hammer', '망치', 150), it('hammer', '특별아이템 (망치 환산)', 50), it('speedup_hours', '가속(시간)', 200)],
  },
];

export type Grade = 'S' | 'A' | 'B' | 'C' | 'D';

export function gradeOf(ratio: number): Grade {
  return ratio >= 1.5 ? 'S' : ratio >= 1.2 ? 'A' : ratio >= 1 ? 'B' : ratio >= 0.8 ? 'C' : 'D';
}

export function itemUnitPrice(stage: PackageGeneration, key: EventItemKey): number {
  return key === 'speedup_hours' ? SPEEDUP_UNIT_PRICE_KRW : unitPrice(stage, key);
}

export interface RankedPackage {
  rank: number;
  pkg: EventPackage;
  items: (EventItem & { unitPriceKRW: number; valueKRW: number })[];
  totalValueKRW: number;
  /** 가치 합 ÷ 가격. 1 = 기준 패키지와 같은 효율 */
  ratio: number;
  grade: Grade;
}

/** 효율 내림차순. 원본처럼 동률이면 입력 순서를 유지한다(Array.sort 는 안정 정렬). */
export function rankEventPackages(pkgs: readonly EventPackage[] = EVENT_PACKAGES): RankedPackage[] {
  return pkgs
    .map((pkg) => {
      const items = pkg.items.map((i) => {
        const u = itemUnitPrice(pkg.stage, i.itemKey);
        return { ...i, unitPriceKRW: u, valueKRW: i.amount * u };
      });
      const totalValueKRW = items.reduce((s, i) => s + i.valueKRW, 0);
      const ratio = totalValueKRW / pkg.priceKRW;
      return { rank: 0, pkg, items, totalValueKRW, ratio, grade: gradeOf(ratio) };
    })
    .sort((a, b) => b.ratio - a.ratio)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

/* ───────────────────────── 2. 토큰 최적화 ───────────────────────── */

export interface TokenPackage {
  price: number;
  tokens: number;
  maxPurchases: number;
}

/** 일반 패키지. 순서가 counts 배열 인덱스다. */
export const TOKEN_PACKAGES: readonly TokenPackage[] = [
  { price: 1500, tokens: 20, maxPurchases: 5 },
  { price: 3000, tokens: 40, maxPurchases: 5 },
  { price: 7500, tokens: 80, maxPurchases: 5 },
  { price: 15000, tokens: 120, maxPurchases: 5 },
  { price: 30000, tokens: 200, maxPurchases: 5 },
  { price: 79000, tokens: 500, maxPurchases: 5 },
  { price: 150000, tokens: 1000, maxPurchases: 5 },
];

/** 누적 토큰이 milestone 이상이면 bonus 를 받는다(누적 지급). */
export const TOKEN_MILESTONES: readonly { milestone: number; bonus: number }[] = [
  { milestone: 50, bonus: 25 },
  { milestone: 200, bonus: 75 },
  { milestone: 500, bonus: 150 },
  { milestone: 1000, bonus: 200 },
  { milestone: 2000, bonus: 300 },
  { milestone: 5000, bonus: 800 },
  { milestone: 10000, bonus: 1000 },
];

/** 무료 토큰: 기본 40 + 일일퀘스트 100 */
export const FREE_TOKENS = 140;
/** 일일퀘스트 2배권: 7,500원, 토큰 +100, 1회 */
export const DAILY_DOUBLE = { price: 7500, tokens: 100 } as const;

export interface TokenPlan {
  target: number;
  reached: boolean;
  useDouble: boolean;
  /** TOKEN_PACKAGES 순서의 구매 횟수 */
  counts: number[];
  totalCost: number;
  progressTokens: number;
  bonusTokens: number;
  finalTokens: number;
  /** 2배권 포함 구매 횟수 */
  packageCount: number;
}

export function milestoneBonus(progress: number): number {
  return TOKEN_MILESTONES.reduce((s, m) => (progress >= m.milestone ? s + m.bonus : s), 0);
}

export function evaluateTokenPlan(target: number, useDouble: boolean, counts: readonly number[]): TokenPlan {
  let tokens = 0;
  let cost = 0;
  let n = useDouble ? 1 : 0;
  TOKEN_PACKAGES.forEach((p, i) => {
    tokens += p.tokens * counts[i];
    cost += p.price * counts[i];
    n += counts[i];
  });
  const progressTokens = FREE_TOKENS + (useDouble ? DAILY_DOUBLE.tokens : 0) + tokens;
  const bonusTokens = milestoneBonus(progressTokens);
  return {
    target,
    reached: progressTokens >= target,
    useDouble,
    counts: [...counts],
    totalCost: cost + (useDouble ? DAILY_DOUBLE.price : 0),
    progressTokens,
    bonusTokens,
    finalTokens: progressTokens + bonusTokens,
    packageCount: n,
  };
}

/** 원본 tie-break: 비용 적은 순 → 토큰 많은 순 → 일반 패키지 비용 적은 순 → 구매 횟수 적은 순 */
function betterPlan(a: TokenPlan, b: TokenPlan): boolean {
  if (a.totalCost !== b.totalCost) return a.totalCost < b.totalCost;
  if (a.progressTokens !== b.progressTokens) return a.progressTokens > b.progressTokens;
  const na = a.totalCost - (a.useDouble ? DAILY_DOUBLE.price : 0);
  const nb = b.totalCost - (b.useDouble ? DAILY_DOUBLE.price : 0);
  if (na !== nb) return na < nb;
  return a.packageCount < b.packageCount;
}

/**
 * 목표 진행 토큰을 채우는 최소 비용 조합. 전부 사도 못 채우면 null.
 * 2배권 미사용/사용 두 경우를 각각 DFS(패키지마다 0..5회, 6^7 이하)로 전수 탐색하고,
 * 현재 최적해보다 비싸지는 가지와 남은 패키지를 다 사도 모자라는 가지는 잘라낸다.
 */
export function optimizeTokens(target: number): TokenPlan | null {
  const zeros = TOKEN_PACKAGES.map(() => 0);
  const maxAll = TOKEN_PACKAGES.reduce((s, p) => s + p.tokens * p.maxPurchases, 0);
  if (FREE_TOKENS + DAILY_DOUBLE.tokens + maxAll < target) return null;
  if (target <= FREE_TOKENS) return evaluateTokenPlan(target, false, zeros);

  const len = TOKEN_PACKAGES.length;
  // suffix[i] = i번째 이후 패키지를 전부 샀을 때 토큰
  const suffix = Array<number>(len + 1).fill(0);
  for (let i = len - 1; i >= 0; i--) suffix[i] = suffix[i + 1] + TOKEN_PACKAGES[i].tokens * TOKEN_PACKAGES[i].maxPurchases;

  let best: TokenPlan | null = null;
  for (const useDouble of [false, true]) {
    const base = FREE_TOKENS + (useDouble ? DAILY_DOUBLE.tokens : 0);
    const extra = useDouble ? DAILY_DOUBLE.price : 0;
    const counts = [...zeros];
    const dfs = (i: number, tokens: number, cost: number): void => {
      if (i === len) {
        if (base + tokens >= target) {
          const plan = evaluateTokenPlan(target, useDouble, counts);
          if (!best || betterPlan(plan, best)) best = plan;
        }
        return;
      }
      const p = TOKEN_PACKAGES[i];
      for (let c = 0; c <= p.maxPurchases; c++) {
        const t = tokens + p.tokens * c;
        const k = cost + p.price * c;
        if (best && extra + k > best.totalCost) break;
        counts[i] = c;
        if (base + t + suffix[i + 1] < target) continue;
        dfs(i + 1, t, k);
      }
      counts[i] = 0;
    };
    dfs(0, 0, 0);
  }
  return best;
}

export interface TokenScenario {
  name: string;
  tone: 'best' | 'good' | 'neutral' | 'danger';
  /** 모든 원본 시나리오가 2배권을 쓴다 */
  counts: readonly number[];
  note: string;
}

/**
 * 원본 페이지의 2,000 / 5,000 / 10,000 비교 시나리오. 원본은 비용·토큰을 숫자로 박아 두었는데,
 * 여기서는 구성(counts)만 두고 evaluateTokenPlan 으로 다시 계산한다. 값은 원본과 같다(self-check 로 확인).
 */
export const TOKEN_SCENARIOS: readonly { target: number; summary: string; scenarios: readonly TokenScenario[] }[] = [
  {
    target: 2000,
    summary:
      'A와 B는 1,500원 차이로 효율이 거의 같습니다. C는 구성이 단순하지만 6,000원 비쌉니다. 79,000원·150,000원 패키지를 섞으면 토큰 단가가 크게 오릅니다. 싼 패키지부터 채우는 게 가장 효율적입니다.',
    scenarios: [
      { name: 'A. 최적해 (최소 비용)', tone: 'best', counts: [4, 5, 5, 4, 3, 0, 0], note: '최소 비용으로 2,000 달성' },
      { name: 'B. 20토큰 초과', tone: 'good', counts: [5, 5, 5, 4, 3, 0, 0], note: '1,500원 더 내고 20토큰 더 확보' },
      { name: 'C. 단순형', tone: 'neutral', counts: [0, 4, 5, 5, 3, 0, 0], note: '구성은 단순하지만 비용 증가' },
      { name: 'D. 79,000원 포함', tone: 'neutral', counts: [4, 5, 5, 4, 1, 1, 0], note: '비싼 패키지가 섞여 단가 상승' },
      { name: 'E. 150,000원 포함', tone: 'neutral', counts: [4, 5, 4, 3, 0, 0, 1], note: '가장 비효율, 비교용' },
    ],
  },
  {
    target: 5000,
    summary:
      '5,000부터는 150,000원 패키지가 필요합니다. 싼 패키지를 먼저 채우고 150,000원 ×3을 더하는 게 가장 싸고, 79,000원 ×5로 대신하면 21,500원, 150,000원 ×5만 사면 91,500원 더 듭니다.',
    scenarios: [
      { name: 'A. 최적해 (최소 비용)', tone: 'best', counts: [4, 5, 5, 4, 3, 0, 3], note: '싼 패키지 우선 + 150,000원 ×3' },
      { name: 'B. 20토큰 초과', tone: 'good', counts: [5, 5, 5, 4, 3, 0, 3], note: '1,500원 더 내고 20토큰 더 확보' },
      { name: 'C. 79,000원 ×5 대체', tone: 'neutral', counts: [5, 5, 5, 5, 5, 5, 0], note: '150,000원 대신 79,000원, 21,500원 비쌈' },
      { name: 'D. 150,000원 ×4 + 중간', tone: 'neutral', counts: [0, 0, 2, 5, 0, 0, 4], note: '싼 패키지를 빼서 비효율' },
      { name: 'E. 150,000원 ×5 단독', tone: 'neutral', counts: [0, 0, 0, 0, 0, 0, 5], note: '최비효율, 최적 대비 91,500원 비쌈' },
    ],
  },
  {
    target: 10000,
    summary:
      '전부 사도 진행 토큰이 10,040이라 여유가 거의 없습니다. 일일퀘스트 2배권은 필수고, 거의 모든 패키지를 최대로 사야 합니다. 비싼 패키지만으로는 10,000에 닿지 않습니다.',
    scenarios: [
      { name: 'A. 최적해 (최소 비용)', tone: 'best', counts: [3, 5, 5, 5, 5, 5, 5], note: '1,500원 ×3 + 나머지 전부 최대, 유일한 최적해' },
      { name: 'B. 전체 올인 (40 초과)', tone: 'good', counts: [5, 5, 5, 5, 5, 5, 5], note: '3,000원 더 내고 40토큰 더 확보' },
      { name: 'C. 비싼 패키지만', tone: 'danger', counts: [0, 0, 0, 0, 5, 5, 5], note: '130만 원을 써도 10,000 미달' },
    ],
  },
];

/* ───────────────────────── 3. 바람을 쫓는 여행 ───────────────────────── */

/** 가속 패키지. 시간만 주고 8시간당 상자 1개가 나온다. */
export const WIND_PACKAGES: readonly { price: number; hours: number; maxPurchases: number }[] = [
  { price: 7500, hours: 100, maxPurchases: 5 },
  { price: 15000, hours: 160, maxPurchases: 5 },
  { price: 30000, hours: 300, maxPurchases: 5 },
  { price: 79000, hours: 600, maxPurchases: 5 },
];

/** 누적 상자 수 달성보상(보상 단위 = 보석 도면 또는 스케치 개수). */
export const WIND_REWARDS: readonly { boxes: number; reward: number }[] = [
  { boxes: 1, reward: 7 },
  { boxes: 5, reward: 15 },
  { boxes: 20, reward: 30 },
  { boxes: 60, reward: 60 },
  { boxes: 120, reward: 135 },
  { boxes: 200, reward: 180 },
  { boxes: 350, reward: 400 },
  { boxes: 600, reward: 700 },
];

export const HOURS_PER_BOX = 8;
/** 슬롯 증설 패키지: 7,500원에 상자 60개 무료(5일, 8시간 간격) */
export const SLOT_PACKAGE = { price: 7500, freeBoxes: 60 } as const;

/** 상자(파도) 가치: 일반 4 / 고급 12 / 정교 24 / 탁월 80, 확률 일반 90% · 고급 10% */
export const BOX_VALUE = { normal: 4, advanced: 12, refined: 24, excellent: 80 } as const;
/** 합성 없이 상자 1개 기대 가치 = 0.9×4 + 0.1×12 = 4.8 */
export const EV_NO_SYNTH = 0.9 * BOX_VALUE.normal + 0.1 * BOX_VALUE.advanced;
/** 고급 3개 → 정교 75% / 탁월 25% = 기대 38 (> 36). 일반 3개 → 고급 1개는 가치 동일 */
export const EV_THREE_ADVANCED = 0.75 * BOX_VALUE.refined + 0.25 * BOX_VALUE.excellent;
/** 끝까지 합성했을 때 상자 1개 기대 가치 = 4.8 × 38/36 ≈ 5.067 (원본 상수 5.0666…와 같다) */
export const EV_FULL_SYNTH = (EV_NO_SYNTH * EV_THREE_ADVANCED) / (3 * BOX_VALUE.advanced);

export type WindItem = 'blueprint' | 'sketch';

export interface WindPlan {
  /** null = "최대" (전부 구매) */
  target: number | null;
  reached: boolean;
  useSlot: boolean;
  /** WIND_PACKAGES 순서의 구매 횟수 */
  counts: number[];
  totalCost: number;
  totalHours: number;
  boxes: number;
  achievementReward: number;
  contentNoSynth: number;
  contentFullSynth: number;
  /** 달성보상 + 풀합성 상자 가치 (아이템 개수) */
  totalValue: number;
  overshoot: number;
}

export function evaluateWindPlan(target: number | null, counts: readonly number[], useSlot: boolean): WindPlan {
  let hours = 0;
  let cost = 0;
  WIND_PACKAGES.forEach((p, i) => {
    hours += p.hours * counts[i];
    cost += p.price * counts[i];
  });
  const boxes = (useSlot ? SLOT_PACKAGE.freeBoxes : 0) + hours / HOURS_PER_BOX;
  const achievementReward = WIND_REWARDS.reduce((s, r) => (boxes >= r.boxes ? s + r.reward : s), 0);
  const contentFullSynth = boxes * EV_FULL_SYNTH;
  return {
    target,
    reached: target === null || boxes >= target,
    useSlot,
    counts: [...counts],
    totalCost: cost + (useSlot ? SLOT_PACKAGE.price : 0),
    totalHours: hours,
    boxes,
    achievementReward,
    contentNoSynth: boxes * EV_NO_SYNTH,
    contentFullSynth,
    totalValue: achievementReward + contentFullSynth,
    overshoot: target === null ? 0 : Math.max(0, boxes - target),
  };
}

/** 시간당 가격이 싼 패키지부터 한 번씩 담는 순서(각 5회). 시간이 선형이라 그리디가 원본 로직이다. */
const WIND_BUY_ORDER = WIND_PACKAGES.flatMap((p, i) => Array<number>(p.maxPurchases).fill(i)).sort(
  (a, b) => WIND_PACKAGES[a].price / WIND_PACKAGES[a].hours - WIND_PACKAGES[b].price / WIND_PACKAGES[b].hours,
);

/** 목표 상자까지 그리디로 구매. 전부 사도 모자라면 reached=false 인 최대 구매 계획이 나온다. */
export function planWind(targetBoxes: number, useSlot: boolean): WindPlan {
  const needHours = HOURS_PER_BOX * Math.max(0, targetBoxes - (useSlot ? SLOT_PACKAGE.freeBoxes : 0));
  const counts = WIND_PACKAGES.map(() => 0);
  let hours = 0;
  for (const i of WIND_BUY_ORDER) {
    if (hours >= needHours) break;
    hours += WIND_PACKAGES[i].hours;
    counts[i]++;
  }
  return evaluateWindPlan(targetBoxes, counts, useSlot);
}

export function planWindMax(useSlot: boolean): WindPlan {
  return evaluateWindPlan(null, WIND_PACKAGES.map((p) => p.maxPurchases), useSlot);
}

export type MarginalGrade = 'best' | 'good' | 'fair' | 'poor';

export interface MarginalRow {
  boxes: number;
  /** 같은 비용으로 함께 달성되는 마일스톤들(첫 슬롯 상자 60개 구간 등) */
  milestones: number[];
  cumulativeCost: number;
  marginalCost: number;
  marginalReward: number;
  /** 추가 보상 ÷ 추가 비용 × 1만. 추가 비용이 0이면 Infinity */
  rewardPerManwon: number;
  grade: MarginalGrade;
}

/** 마일스톤마다 그리디 계획을 세우고, 직전 마일스톤 대비 추가 비용·추가 보상으로 한계효용을 매긴다. */
export function windMarginalTable(useSlot: boolean): MarginalRow[] {
  // 1) 마일스톤별 누적 비용·누적 보상. 비용이 직전과 같으면 직전 묶음에 합친다(원본 동작).
  const groups: { boxes: number; milestones: number[]; cost: number; reward: number }[] = [];
  let cumReward = 0;
  for (const r of WIND_REWARDS) {
    cumReward += r.reward;
    const cost = planWind(r.boxes, useSlot).totalCost;
    const last = groups[groups.length - 1];
    if (last && last.cost === cost) {
      last.boxes = r.boxes;
      last.milestones.push(r.boxes);
      last.reward = cumReward;
    } else {
      groups.push({ boxes: r.boxes, milestones: [r.boxes], cost, reward: cumReward });
    }
  }
  // 2) 직전 묶음 대비 차분
  return groups.map((g, i) => {
    const prev = groups[i - 1] ?? { cost: 0, reward: 0 };
    const marginalCost = g.cost - prev.cost;
    const marginalReward = g.reward - prev.reward;
    const v = marginalCost > 0 ? (marginalReward / marginalCost) * 1e4 : Infinity;
    return {
      boxes: g.boxes,
      milestones: g.milestones,
      cumulativeCost: g.cost,
      marginalCost,
      marginalReward,
      rewardPerManwon: v,
      grade: v >= 35 ? 'best' : v >= 28 ? 'good' : v >= 24 ? 'fair' : 'poor',
    };
  });
}

/** 보상 아이템 1개의 원화 단가(선택 세대 기준 패키지로 환산). */
export function windItemUnitPrice(stage: PackageGeneration, item: WindItem): number {
  return unitPrice(stage, item);
}
