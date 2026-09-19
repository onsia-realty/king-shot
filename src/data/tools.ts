/**
 * 계산기 목록 단일 소스. /tools 인덱스와 각 계산기 페이지의 관련 링크가 공유한다.
 *
 * 계산기를 새로 추가하면 여기에 한 줄 넣으면 된다. 순서가 곧 노출 순서다.
 */
export interface ToolItem {
  label: string;
  href: string;
  /** 인덱스 카드에 들어가는 한 줄 설명 */
  summary: string;
}

export const TOOLS: readonly ToolItem[] = [
  {
    label: '영웅 승급 파편 계산기',
    href: '/tools/hero-ascension/',
    summary:
      '현재 등급과 성급에서 목표까지 필요한 파편 수를 단계별로 계산합니다. 보유량을 넣으면 부족분까지 나옵니다.',
  },
  {
    label: '영웅 비교',
    href: '/tools/hero-comparison/',
    summary:
      '영웅 두 명의 토벌·원정 스탯과 스킬, 전용 장비를 나란히 놓고 비교합니다. 어느 쪽이 높은지 바로 보입니다.',
  },
  {
    label: '건물 업그레이드 계산기',
    href: '/tools/building-calculator/',
    summary:
      '현재 레벨에서 목표 레벨까지 드는 자원과 시간을 합산합니다. 건설 속도 보너스를 반영할 수 있습니다.',
  },
] as const;
