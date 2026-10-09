/**
 * 패키지 기준표. 기준가 패키지 한 개(7,500원)에 아이템이 몇 개 들어 있는지를 순금 세대별로 정리한다.
 * 스펙업·패키지 계산기가 이 표를 단가 기준으로 import해 쓴다.
 *
 * 출처: https://kshot-lab.com/tools/package-ref 의 공개 클라이언트 데이터(REFERENCE_PACKAGE_RULES).
 * 수집일: 2026-10-09
 *
 * 주의: `predicted: true` 세대는 실측이 아니라 앞 세대 증분을 외삽한 예측치다.
 * 특히 순금 9/10은 보석 도면·비단·금사를 진급 값 그대로 두었기 때문에 실제보다 낮게 잡혔을 수 있다.
 * 게임 내 패키지 구성과 다르면 게임 쪽을 따른다.
 */

/** 기준 패키지 가격(원). 해외 스토어 기준가는 4.99달러. */
export const BASE_PACKAGE_PRICE_KRW = 7500;

export type PackageGeneration =
  | 'gold_123'
  | 'gold_45'
  | 'war_academy'
  | 'gold_678_predicted'
  | 'gold_promotion_predicted'
  | 'gold_910_predicted';

export type PackageItem =
  | 'hammer'
  | 'exp_parts'
  | 'hero_gear_box'
  | 'gold'
  | 'blueprint'
  | 'satin'
  | 'thread'
  | 'sketch';

/** 표 열 순서 겸 한국어 이름 */
export const PACKAGE_ITEMS: readonly { key: PackageItem; name: string }[] = [
  { key: 'hammer', name: '망치' },
  { key: 'exp_parts', name: '영웅장비 EXP' },
  { key: 'hero_gear_box', name: '영웅 장비 상자' },
  { key: 'gold', name: '순금' },
  { key: 'blueprint', name: '보석 도면 및 매뉴얼' },
  { key: 'satin', name: '비단' },
  { key: 'thread', name: '금사' },
  { key: 'sketch', name: '스케치' },
];

export interface PackageGenerationRow {
  key: PackageGeneration;
  name: string;
  predicted: boolean;
  notes?: string;
  /** 기준 패키지 한 개에 들어 있는 수량 */
  quantities: Readonly<Record<PackageItem, number>>;
}

/** 세대 순서대로. 진행이 빠른 순 = 배열 순이다. */
export const PACKAGE_GENERATIONS: readonly PackageGenerationRow[] = [
  {
    key: 'gold_123',
    name: '순금 1/2/3',
    predicted: false,
    quantities: { hammer: 12, exp_parts: 1800, hero_gear_box: 12, gold: 36, blueprint: 60, satin: 9000, thread: 90, sketch: 35 },
  },
  {
    key: 'gold_45',
    name: '순금 4/5',
    predicted: false,
    quantities: { hammer: 18, exp_parts: 3000, hero_gear_box: 18, gold: 48, blueprint: 60, satin: 12000, thread: 120, sketch: 45 },
  },
  {
    key: 'war_academy',
    name: '전쟁 아카데미',
    predicted: false,
    quantities: { hammer: 24, exp_parts: 4200, hero_gear_box: 24, gold: 60, blueprint: 60, satin: 15000, thread: 150, sketch: 55 },
  },
  {
    key: 'gold_678_predicted',
    name: '순금 6/7/8',
    predicted: true,
    quantities: { hammer: 30, exp_parts: 5400, hero_gear_box: 30, gold: 72, blueprint: 66, satin: 21500, thread: 215, sketch: 65 },
  },
  {
    key: 'gold_promotion_predicted',
    name: '순금 진급',
    predicted: true,
    notes:
      '순금 6/7/8 다음 칸으로 만든 예측값입니다. 2026-08-03 진급 해금 뒤 이 행을 진급 구간으로 옮겼고 값은 바꾸지 않았습니다.',
    quantities: { hammer: 36, exp_parts: 6600, hero_gear_box: 36, gold: 84, blueprint: 75, satin: 28000, thread: 280, sketch: 75 },
  },
  {
    key: 'gold_910_predicted',
    name: '순금 9/10',
    predicted: true,
    notes:
      '진급 다음 칸 예측값입니다. 망치·EXP·상자·순금·스케치만 외삽했고, 보석 도면·비단·금사는 증분이 불규칙해 진급 값을 그대로 둬서 실제보다 낮을 수 있습니다.',
    quantities: { hammer: 42, exp_parts: 7800, hero_gear_box: 42, gold: 96, blueprint: 75, satin: 28000, thread: 280, sketch: 85 },
  },
];

export function getPackageGeneration(key: PackageGeneration): PackageGenerationRow {
  // 키가 타입으로 막혀 있어 못 찾는 경우는 없다.
  return PACKAGE_GENERATIONS.find((g) => g.key === key)!;
}

/**
 * 아이템 1개의 원화 단가 = 기준가 / 기준 패키지 수량.
 * 원본 로직처럼 수량이 0이면 1로 나눈다.
 * (참고: 원본 진행 계산기는 비단·금사를 세트 패키지 반분 기준 3,750원으로 계산한다. 필요하면 호출 쪽에서 반영.)
 */
export function unitPrice(generation: PackageGeneration, item: PackageItem): number {
  const qty = getPackageGeneration(generation).quantities[item];
  return BASE_PACKAGE_PRICE_KRW / (qty || 1);
}
