/**
 * 게임 내 공식 한국어 표기 라벨.
 *
 * 스키마와 필터·정렬 로직은 계속 영문 enum 코드(SSR/SR/R/N, TroopClass)로 동작하고,
 * 사용자에게 보이는 문자열만 여기서 가져다 쓴다.
 * 출처: Century Games 공식 위키 한국어판 https://kingshotwiki.com/ko/
 */

export type Rarity = 'SSR' | 'SR' | 'R' | 'N';
export type TroopClass = '보병' | '궁병' | '기병';

/** 등급 코드 → 게임 내 공식 등급명 */
export const RARITY_LABEL: Record<Rarity, string> = {
  SSR: '전설',
  SR: '에픽',
  R: '레어',
  N: '일반',
};

/** 목록/필터에서 쓰는 등급 표시 순서 (높은 등급 우선) */
export const RARITY_ORDER: readonly Rarity[] = ['SSR', 'SR', 'R', 'N'] as const;

/** 등급 코드 → 정렬 가중치 */
export const RARITY_RANK: Record<Rarity, number> = { SSR: 0, SR: 1, R: 2, N: 3 };

export function rarityLabel(rarity: string): string {
  return RARITY_LABEL[rarity as Rarity] ?? rarity;
}

/** 병종 목록 (공식 표기) */
export const TROOP_CLASSES: readonly TroopClass[] = ['보병', '궁병', '기병'] as const;

/** 병종별 아이콘 글리프 */
export const TROOP_CLASS_GLYPH: Record<TroopClass, string> = {
  보병: '🛡️',
  궁병: '🏹',
  기병: '🐎',
};
