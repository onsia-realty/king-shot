/**
 * 네비게이션 단일 소스. Header / Footer / sitemap 안내가 공유한다.
 */
export interface NavItem {
  label: string;
  href: string;
  /** 하위 경로도 현재 메뉴로 볼지 여부 (기본 true, 홈만 false) */
  matchPrefix?: boolean;
}

export const SITE_NAME = '킹샷 공략';
export const SITE_DESCRIPTION =
  '킹샷(Kingshot) 한국어 공략 사이트. 영웅 티어, 건물 테크, 펫, 곰 사냥, 기프트 코드까지 초보자도 바로 쓰는 정보만 정리했습니다.';

export const mainNav: NavItem[] = [
  { label: '홈', href: '/', matchPrefix: false },
  { label: '공략', href: '/guides/' },
  { label: '영웅', href: '/heroes/' },
  { label: '건물', href: '/buildings/' },
  { label: '펫', href: '/pets/' },
  { label: '기프트코드', href: '/gift-codes/' },
];

/** 커뮤니티(카카오톡 오픈채팅) 단일 소스 */
export const KAKAO_OPENCHAT = {
  url: 'https://open.kakao.com/o/gSpop0Mi',
  label: '카카오톡 오픈채팅',
  roomName: '[킹샷] 초보 공략 & 한국인 국왕·신입 연맹 환영',
  blurb: '질문·연맹 모집·정보 공유',
} as const;

export const footerNav: NavItem[] = [
  { label: '소개', href: '/about/' },
  { label: '개인정보처리방침', href: '/privacy/' },
];

/** 현재 경로가 해당 메뉴에 해당하는지 */
export function isActive(item: NavItem, pathname: string): boolean {
  const current = pathname.endsWith('/') ? pathname : `${pathname}/`;
  if (item.matchPrefix === false) return current === item.href;
  return current === item.href || current.startsWith(item.href);
}
