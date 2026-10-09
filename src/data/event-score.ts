/**
 * 이벤트 점수 계산기 데이터와 계산 함수. KvK(1~5일차)와 지고의 영주(1~7일차)의 일자별 배점,
 * 병력 훈련·승급 1명당 점수를 담고, 보유 아이템으로 각 이벤트의 예상 총점과 일자별 배분을 낸다.
 *
 * 출처: https://kshot-lab.com/tools/event-score 의 공개 클라이언트 데이터와 계산 로직.
 * 수집일: 2026-10-09
 *
 * 한계:
 * - KvK는 원본이 "스크린샷에서 확인된 1~5일차 항목만" 반영했다. 6일차 이후와 화면에 안 보인 항목은
 *   빠져 있어서 KvK 총점은 실제보다 낮게 나올 수 있다.
 * - 아이템은 한 번만 쓴다고 보고 배점이 가장 높은 일자에 몰아 넣는다(일자 분할 없음).
 * - 게임에서는 아이템을 직접 쓰는 게 아니라 건설·연구·제작으로 소모할 때 점수가 들어오므로
 *   소모 순서, 버프, 특수 규칙에 따라 실제 점수는 달라질 수 있다.
 */

export type EventId = 'kvk' | 'supreme_lord';

export type ScoreItemId =
  | 'gold_bar'
  | 'truegold_dust'
  | 'refined_truegold'
  | 'construction_speedup_min'
  | 'research_speedup_min'
  | 'training_speedup_min'
  | 'rare_shard'
  | 'epic_shard'
  | 'legend_shard'
  | 'pet_advanced_training'
  | 'pet_normal_training'
  | 'hammer'
  | 'exclusive_gear'
  | 'mithril'
  // 아래는 보유량이 아니라 행동이라 입력은 받지 않고 배점표에만 나온다.
  | 'lord_gem_rating'
  | 'intel_event'
  | 'roulette_spin'
  | 'food_gather_1000'
  | 'wood_gather_1000'
  | 'stone_gather_200'
  | 'iron_gather_50'
  | 'pet_breakthrough_rating'
  | 'lord_equipment_rating'
  | 'troop_t1_training'
  | 'troop_t2_training'
  | 'troop_t10_training'
  | 'troop_t1_t9_training_score'
  | 'gathering_score';

export interface ScoreItem {
  name: string;
  unit: string;
  /** item = 인벤토리에 쌓이는 아이템(입력 대상), action = 행동 */
  kind: 'item' | 'action';
}

export const SCORE_ITEMS: Readonly<Record<ScoreItemId, ScoreItem>> = {
  gold_bar: { name: '순금', unit: '개', kind: 'item' },
  truegold_dust: { name: '순금 가루', unit: '개', kind: 'item' },
  refined_truegold: { name: '정제 순금', unit: '개', kind: 'item' },
  construction_speedup_min: { name: '건설 가속', unit: '분', kind: 'item' },
  research_speedup_min: { name: '연구 가속', unit: '분', kind: 'item' },
  training_speedup_min: { name: '훈련/승급 가속', unit: '분', kind: 'item' },
  rare_shard: { name: '레어 영웅 파편', unit: '개', kind: 'item' },
  epic_shard: { name: '에픽 영웅 파편', unit: '개', kind: 'item' },
  legend_shard: { name: '레전드 영웅 파편', unit: '개', kind: 'item' },
  pet_advanced_training: { name: '고급 훈련 기록', unit: '개', kind: 'item' },
  pet_normal_training: { name: '일반 훈련 기록', unit: '개', kind: 'item' },
  hammer: { name: '영웅 장비 제작 망치', unit: '개', kind: 'item' },
  exclusive_gear: { name: '영웅 전용 장비 부속품', unit: '개', kind: 'item' },
  mithril: { name: '미스릴', unit: '개', kind: 'item' },
  lord_gem_rating: { name: '영주 장비 보석 평점 증가', unit: '점', kind: 'action' },
  intel_event: { name: '정보 이벤트 완료', unit: '개', kind: 'action' },
  roulette_spin: { name: '영웅 룰렛 참여', unit: '회', kind: 'action' },
  food_gather_1000: { name: '야외 식량 수집 1,000개', unit: '회', kind: 'action' },
  wood_gather_1000: { name: '야외 목재 채집 1,000개', unit: '회', kind: 'action' },
  stone_gather_200: { name: '야외 석재 채집 200개', unit: '회', kind: 'action' },
  iron_gather_50: { name: '야외 철광 채집 50개', unit: '회', kind: 'action' },
  pet_breakthrough_rating: { name: '펫 돌파 평점 증가', unit: '점', kind: 'action' },
  lord_equipment_rating: { name: '영주 장비 평점 증가(보석 제외)', unit: '점', kind: 'action' },
  troop_t1_training: { name: '1급 병사 훈련', unit: '명', kind: 'action' },
  troop_t2_training: { name: '2급 병사 훈련', unit: '명', kind: 'action' },
  troop_t10_training: { name: '10급 병사 훈련', unit: '명', kind: 'action' },
  troop_t1_t9_training_score: { name: '1~9급 병사 훈련 점수', unit: '점', kind: 'action' },
  gathering_score: { name: '채집 점수', unit: '점', kind: 'action' },
};

/** 입력 폼 순서. 원본이 두 이벤트 아이템 목록을 합쳐 item만 거른 순서와 같다. */
export const INPUT_ITEM_IDS: readonly ScoreItemId[] = [
  'gold_bar',
  'truegold_dust',
  'refined_truegold',
  'construction_speedup_min',
  'research_speedup_min',
  'training_speedup_min',
  'rare_shard',
  'epic_shard',
  'legend_shard',
  'pet_advanced_training',
  'pet_normal_training',
  'hammer',
  'exclusive_gear',
  'mithril',
];

export interface EventStage {
  day: number;
  name: string;
  /** 단위당 점수. 없는 항목은 그 날 점수가 없다. */
  rates: Readonly<Partial<Record<ScoreItemId, number>>>;
}

export interface ScoreEvent {
  id: EventId;
  name: string;
  /** 배점표 행 순서 */
  items: readonly ScoreItemId[];
  stages: readonly EventStage[];
}

// 공통 배점 묶음. 여러 일자에 같은 값으로 반복된다.
const TRUEGOLD = { gold_bar: 2000, truegold_dust: 1000, refined_truegold: 40000 } as const;
const SPEEDUPS = {
  construction_speedup_min: 30,
  research_speedup_min: 30,
  training_speedup_min: 30,
} as const;
const SHARDS = { rare_shard: 350, epic_shard: 1220, legend_shard: 3040 } as const;
const PET = {
  pet_breakthrough_rating: 50,
  pet_advanced_training: 15000,
  pet_normal_training: 1150,
} as const;
const GEAR = { hammer: 4000, exclusive_gear: 8000, mithril: 40000 } as const;
const GATHER = {
  food_gather_1000: 2,
  wood_gather_1000: 2,
  stone_gather_200: 2,
  iron_gather_50: 2,
} as const;

export const SCORE_EVENTS: readonly ScoreEvent[] = [
  {
    id: 'kvk',
    name: 'KvK',
    items: [
      'lord_gem_rating',
      ...INPUT_ITEM_IDS.slice(0, 6),
      'intel_event',
      'roulette_spin',
      'rare_shard',
      'epic_shard',
      'legend_shard',
      'food_gather_1000',
      'wood_gather_1000',
      'stone_gather_200',
      'iron_gather_50',
      'pet_breakthrough_rating',
      'pet_advanced_training',
      'pet_normal_training',
      'hammer',
      'exclusive_gear',
      'mithril',
      'troop_t1_training',
      'troop_t2_training',
      'troop_t10_training',
      'lord_equipment_rating',
    ],
    stages: [
      {
        day: 1,
        name: '도시 건설',
        rates: { lord_gem_rating: 70, ...TRUEGOLD, ...SPEEDUPS, intel_event: 6000 },
      },
      {
        day: 2,
        name: '2일차',
        rates: { ...TRUEGOLD, ...SPEEDUPS, roulette_spin: 8000, ...SHARDS, ...GATHER },
      },
      {
        day: 3,
        name: '3일차',
        rates: {
          ...PET,
          lord_gem_rating: 70,
          roulette_spin: 8000,
          ...SHARDS,
          intel_event: 6000,
        },
      },
      {
        day: 4,
        name: '4일차',
        rates: {
          lord_gem_rating: 70,
          ...GEAR,
          troop_t1_training: 3,
          troop_t2_training: 4,
          troop_t10_training: 60,
          ...GATHER,
        },
      },
      {
        day: 5,
        name: '5일차',
        rates: {
          ...PET,
          lord_equipment_rating: 36,
          ...GEAR,
          ...TRUEGOLD,
          ...SPEEDUPS,
          intel_event: 6000,
          ...GATHER,
        },
      },
    ],
  },
  {
    id: 'supreme_lord',
    name: '지고의 영주',
    items: [
      ...INPUT_ITEM_IDS.slice(0, 6),
      'lord_gem_rating',
      'roulette_spin',
      'rare_shard',
      'epic_shard',
      'legend_shard',
      'hammer',
      'exclusive_gear',
      'mithril',
      'pet_breakthrough_rating',
      'pet_normal_training',
      'pet_advanced_training',
      'lord_equipment_rating',
      'troop_t1_t9_training_score',
      'troop_t10_training',
      'gathering_score',
    ],
    stages: [
      { day: 1, name: '도시 건설', rates: { ...TRUEGOLD, ...SPEEDUPS, lord_gem_rating: 70 } },
      {
        day: 2,
        name: '영웅 성장',
        rates: { ...TRUEGOLD, ...SPEEDUPS, roulette_spin: 8000, ...SHARDS, ...GEAR },
      },
      {
        day: 3,
        name: '기초 능력 향상',
        rates: { ...PET, lord_gem_rating: 70, roulette_spin: 8000, ...SHARDS },
      },
      {
        day: 4,
        name: '전투 능력 향상',
        rates: {
          lord_gem_rating: 70,
          ...GEAR,
          troop_t1_t9_training_score: 1,
          troop_t10_training: 39,
        },
      },
      { day: 5, name: '기초 능력 향상', rates: { ...TRUEGOLD, ...SPEEDUPS, ...GEAR } },
      {
        day: 6,
        name: '전투력 향상',
        rates: { lord_equipment_rating: 36, troop_t1_t9_training_score: 1, troop_t10_training: 39 },
      },
      {
        day: 7,
        name: '영웅 성장',
        rates: {
          ...PET,
          ...TRUEGOLD,
          ...SPEEDUPS,
          lord_equipment_rating: 36,
          gathering_score: 1,
          ...SHARDS,
        },
      },
    ],
  },
];

/** 병력 1명당 [소요 초, 전투력, KvK 점수, 지고의 영주 점수] */
export type TroopRow = readonly [sec: number, power: number, kvk: number, supremeLord: number];

/** 신규 훈련. 키 = 티어 */
export const TROOP_TRAINING: Readonly<Record<number, TroopRow>> = {
  1: [12, 3, 3, 1],
  2: [17, 4, 4, 2],
  3: [24, 6, 5, 3],
  4: [32, 9, 8, 5],
  5: [44, 13, 12, 7],
  6: [60, 20, 18, 11],
  7: [83, 28, 25, 16],
  8: [113, 38, 35, 23],
  9: [131, 50, 45, 30],
  10: [152, 66, 60, 39],
  11: [180, 84, 75, 50],
};

/** 승급. 키 = `${출발}-${목표}` */
export const TROOP_PROMOTION: Readonly<Record<string, TroopRow>> = {
  '1-2': [5, 1, 1, 1],
  '1-3': [12, 3, 2, 2],
  '1-4': [20, 6, 5, 4],
  '1-5': [32, 10, 9, 6],
  '1-6': [48, 17, 15, 10],
  '1-7': [71, 25, 22, 15],
  '1-8': [101, 35, 32, 22],
  '1-9': [119, 47, 42, 29],
  '1-10': [140, 63, 57, 38],
  '1-11': [168, 81, 72, 49],
  '2-3': [7, 2, 1, 1],
  '2-4': [15, 5, 4, 3],
  '2-5': [27, 9, 8, 5],
  '2-6': [43, 16, 14, 9],
  '2-7': [66, 24, 21, 14],
  '2-8': [96, 34, 31, 21],
  '2-9': [114, 46, 41, 28],
  '2-10': [135, 62, 56, 37],
  '2-11': [163, 80, 71, 48],
  '3-4': [8, 3, 3, 2],
  '3-5': [20, 7, 7, 4],
  '3-6': [36, 14, 13, 8],
  '3-7': [59, 22, 20, 13],
  '3-8': [89, 32, 30, 20],
  '3-9': [107, 44, 40, 27],
  '3-10': [128, 60, 55, 36],
  '3-11': [156, 78.19, 70, 47],
  '4-5': [12, 4, 4, 2],
  '4-6': [28, 11, 10, 6],
  '4-7': [51, 19, 17, 11],
  '4-8': [81, 29, 27, 18],
  '4-9': [99, 41, 37, 25],
  '4-10': [120, 57, 52, 34],
  '4-11': [148, 75, 67, 45],
  '5-6': [16, 7, 6, 4],
  '5-7': [39, 15, 13, 9],
  '5-8': [69, 25, 23, 16],
  '5-9': [87, 37, 33, 23],
  '5-10': [108, 53, 48, 32],
  '5-11': [136, 71.16, 63, 43],
  '6-7': [23, 8, 7, 5],
  '6-8': [53, 18, 17, 12],
  '6-9': [71, 30, 27, 19],
  '6-10': [92, 46, 42, 28],
  '6-11': [120, 64, 57, 39],
  '7-8': [30, 10, 10, 7],
  '7-9': [48, 22, 20, 14],
  '7-10': [69, 38, 35, 23],
  '7-11': [97, 56, 50, 34],
  '8-9': [18, 12, 10, 7],
  '8-10': [39, 28, 25, 16],
  '8-11': [67, 46, 40, 27],
  '9-10': [21, 16, 15, 9],
  '9-11': [49, 34, 30, 20],
  '10-11': [28, 18, 15, 11],
};

export type Inventory = Readonly<Partial<Record<ScoreItemId, number>>>;

export interface TroopOptions {
  mode: 'training' | 'promotion';
  /** 훈련 티어, 승급이면 목표 티어 */
  tier: number;
  /** 승급 출발 티어 (승급일 때만 씀) */
  fromTier: number;
  /** 승급할 보유 병력. 0이면 가속 상한까지 */
  availableTroops: number;
  trainSpeedPercent: number;
}

/** 이 이벤트에서 아이템 배점 최댓값과 그 값을 주는 일자들(빠른 순) */
export function bestRate(event: ScoreEvent, id: ScoreItemId): { rate: number; days: number[] } {
  let rate = 0;
  let days: number[] = [];
  for (const s of event.stages) {
    const r = s.rates[id] ?? 0;
    if (r > rate) {
      rate = r;
      days = [s.day];
    } else if (r === rate && rate > 0) {
      days.push(s.day);
    }
  }
  return { rate, days };
}

function troopPoints(row: TroopRow, eventId: EventId): number {
  return eventId === 'kvk' ? row[2] : row[3];
}

/** 가속 `minutes`분으로 뽑을 수 있는 병력 수 */
export function troopsBySpeedup(row: TroopRow, minutes: number, speedPct: number): number {
  if (minutes <= 0) return 0;
  const sec = row[0] / (1 + Math.max(0, speedPct) / 100);
  return sec <= 0 ? 0 : Math.floor((60 * minutes) / sec);
}

export interface TrainingRoute {
  minutes: number;
  chosen: 'train' | 'burn';
  /** 가속을 그대로 태울 때 점수 */
  burnScore: number;
  /** 병력 훈련(+남는 가속 처리) 점수 */
  trainScore: number;
  troopsBySpeedup: number;
  /** 승급 보유 병력. 입력이 없으면 null */
  availableTroops: number | null;
  troops: number;
  leftoverMinutes: number;
  leftoverUse: 'none' | 'train' | 'burn';
  leftoverTroops: number;
  leftoverScore: number;
  powerGain: number;
}

/**
 * 훈련 가속을 병력에 쓸지, 가속 자체로 태울지 고른다.
 * 승급이면 보유 병력만큼만 올리고, 남는 가속은 같은 목표 티어 신규 훈련과 태우기 중 큰 쪽에 쓴다.
 */
export function trainingRoute(
  event: ScoreEvent,
  inv: Inventory,
  opt: TroopOptions,
): TrainingRoute | null {
  const minutes = Math.max(0, inv.training_speedup_min ?? 0);
  if (minutes <= 0) return null;
  const promo = opt.mode === 'promotion';
  const row = promo ? TROOP_PROMOTION[`${opt.fromTier}-${opt.tier}`] : TROOP_TRAINING[opt.tier];
  if (!row) return null;

  const rate = bestRate(event, 'training_speedup_min').rate;
  const burnScore = minutes * rate;
  const bySpeedup = troopsBySpeedup(row, minutes, opt.trainSpeedPercent);
  const available =
    promo && opt.availableTroops > 0 ? Math.floor(opt.availableTroops) : null;
  const troops = available === null ? bySpeedup : Math.min(bySpeedup, available);
  const effSec = row[0] / (1 + Math.max(0, opt.trainSpeedPercent) / 100);
  const leftoverMinutes = Math.max(0, Math.floor(minutes - (troops * effSec) / 60));

  let leftoverUse: TrainingRoute['leftoverUse'] = 'none';
  let leftoverTroops = 0;
  let leftoverScore = 0;
  if (leftoverMinutes > 0) {
    const burn = leftoverMinutes * rate;
    const fresh = TROOP_TRAINING[opt.tier];
    const n = fresh ? troopsBySpeedup(fresh, leftoverMinutes, opt.trainSpeedPercent) : 0;
    const train = fresh ? n * troopPoints(fresh, event.id) : 0;
    if (train > burn) {
      leftoverUse = 'train';
      leftoverTroops = n;
      leftoverScore = train;
    } else {
      leftoverUse = 'burn';
      leftoverScore = burn;
    }
  }

  const trainScore = troops * troopPoints(row, event.id) + leftoverScore;
  return {
    minutes,
    chosen: trainScore > burnScore ? 'train' : 'burn',
    burnScore,
    trainScore,
    troopsBySpeedup: bySpeedup,
    availableTroops: available,
    troops,
    leftoverMinutes,
    leftoverUse,
    leftoverTroops,
    leftoverScore,
    powerGain: troops * row[1],
  };
}

export interface ItemPlan {
  id: ScoreItemId;
  quantity: number;
  pointsPerUnit: number;
  score: number;
  /** 배정 일자 (동률이면 가장 빠른 날) */
  day: number;
  /** 같은 점수를 주는 다른 일자 */
  tiedDays: number[];
}

export interface EventPlan {
  event: ScoreEvent;
  totalScore: number;
  stages: { stage: EventStage; items: ItemPlan[]; subtotal: number }[];
  itemPlans: ItemPlan[];
  unusedItems: { id: ScoreItemId; quantity: number }[];
  route: TrainingRoute | null;
}

/** 보유 아이템을 한 번씩만 쓴다고 보고 이벤트 하나의 예상 총점과 일자별 배분을 만든다. */
export function planEvent(event: ScoreEvent, inv: Inventory, opt: TroopOptions): EventPlan {
  const route = trainingRoute(event, inv, opt);
  const train = route?.chosen === 'train';
  const itemPlans: ItemPlan[] = [];
  const unusedItems: EventPlan['unusedItems'] = [];

  for (const id of INPUT_ITEM_IDS) {
    const quantity = Math.max(0, inv[id] ?? 0);
    if (quantity <= 0 || (id === 'training_speedup_min' && train)) continue;
    const { rate, days } = bestRate(event, id);
    if (rate <= 0) {
      unusedItems.push({ id, quantity });
      continue;
    }
    itemPlans.push({
      id,
      quantity,
      pointsPerUnit: rate,
      score: quantity * rate,
      day: days[0],
      tiedDays: days.slice(1),
    });
  }

  const stages = event.stages.map((stage) => {
    const items = itemPlans.filter((p) => p.day === stage.day);
    return { stage, items, subtotal: items.reduce((a, p) => a + p.score, 0) };
  });
  const totalScore =
    itemPlans.reduce((a, p) => a + p.score, 0) + (train && route ? route.trainScore : 0);
  return { event, totalScore, stages, itemPlans, unusedItems, route };
}

/** 두 이벤트를 총점 내림차순으로. margin = 1위 - 2위 */
export function compareEvents(
  inv: Inventory,
  opt: TroopOptions,
): { plans: EventPlan[]; margin: number } {
  const plans = SCORE_EVENTS.map((e) => planEvent(e, inv, opt)).sort(
    (a, b) => b.totalScore - a.totalScore,
  );
  const margin = plans.length > 1 ? plans[0].totalScore - plans[1].totalScore : 0;
  return { plans, margin };
}
