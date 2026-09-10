import type { CollectionEntry } from 'astro:content';

export type Guide = CollectionEntry<'guides'>;
export type GuideCategory = Guide['data']['category'];
export type GuideDifficulty = Guide['data']['difficulty'];

/**
 * 한국어 카테고리 → URL용 영문 슬러그.
 * 카테고리는 콘텐츠 스키마의 enum 과 1:1로 대응한다.
 */
export const CATEGORY_SLUGS = {
  입문: 'beginner',
  영웅: 'hero',
  전투: 'combat',
  건설: 'building',
  이벤트: 'event',
  연맹: 'alliance',
  과금: 'spending',
  이민: 'transfer',
} as const satisfies Record<GuideCategory, string>;

export type CategorySlug = (typeof CATEGORY_SLUGS)[GuideCategory];

export const CATEGORIES = Object.keys(CATEGORY_SLUGS) as GuideCategory[];

/** 카테고리 목록/상세 페이지 상단에 쓰는 한 줄 설명 */
export const CATEGORY_DESCRIPTIONS: Record<GuideCategory, string> = {
  입문: '이제 막 시작했다면 여기부터. 초반 성장 순서와 기본 개념을 다룹니다.',
  영웅: '영웅 티어와 조합, 스킬과 전용 장비 활용법을 정리했습니다.',
  전투: '집결과 방어, 병종 상성처럼 실제 전투에서 갈리는 부분을 다룹니다.',
  건설: '도시 센터를 축으로 한 건물 순서와 자원 배분 요령입니다.',
  이벤트: '곰사냥, KvK 같은 주요 이벤트의 규칙과 준비 방법입니다.',
  연맹: '연맹 운영과 등급 체계, 협업으로 이득 보는 법을 다룹니다.',
  과금: '무과금부터 소과금까지, 돈과 시간을 어디에 쓸지 판단하는 기준입니다.',
  이민: '왕국 이민 조건과 좋은 서버를 고르는 기준을 정리했습니다.',
};

/** 카테고리 칩에 붙이는 이모지 */
export const CATEGORY_EMOJI: Record<GuideCategory, string> = {
  입문: '🌱',
  영웅: '🦸',
  전투: '⚔️',
  건설: '🏰',
  이벤트: '🎉',
  연맹: '🤝',
  과금: '💎',
  이민: '🧭',
};

export function categorySlug(category: GuideCategory): CategorySlug {
  return CATEGORY_SLUGS[category];
}

export function categoryHref(category: GuideCategory): string {
  return `/guides/category/${CATEGORY_SLUGS[category]}/`;
}

export function categoryFromSlug(slug: string): GuideCategory | undefined {
  return CATEGORIES.find((c) => CATEGORY_SLUGS[c] === slug);
}

export function guideHref(entry: Pick<Guide, 'id'>): string {
  return `/guides/${entry.id}/`;
}

/** 수정일이 있으면 수정일, 없으면 발행일 */
export function lastUpdated(entry: Guide): Date {
  return entry.data.updated ?? entry.data.published;
}

/** 발행일 최신순 (같으면 제목순) */
export function sortByPublished(entries: Guide[]): Guide[] {
  return [...entries].sort((a, b) => {
    const diff = b.data.published.valueOf() - a.data.published.valueOf();
    if (diff !== 0) return diff;
    return a.data.title.localeCompare(b.data.title, 'ko');
  });
}

/** 2026년 9월 10일 */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

/** 2026-09-10 (datetime 속성용) */
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * 예상 읽기 시간(분). 한국어 기준 분당 500자.
 * 코드블록·마크다운 기호·공백은 빼고 센다.
 */
export function readingMinutes(body: string | undefined): number {
  if (!body) return 1;
  const text = body
    .replace(/```[\s\S]*?```/g, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`|~\-]/g, '')
    .replace(/\s+/g, '');
  return Math.max(1, Math.ceil(text.length / 500));
}

export const DIFFICULTY_STYLES: Record<GuideDifficulty, string> = {
  입문: 'text-success border-success/45 bg-success/12',
  중급: 'text-link border-link/45 bg-link/12',
  고급: 'text-danger border-danger/45 bg-danger/12',
};

/**
 * 관련 글 고르기.
 * 1) frontmatter related  2) 같은 카테고리  3) 태그 겹치는 글 순으로 채운다.
 * 자기 자신과 중복은 뺀다.
 */
export function pickRelated(current: Guide, pool: Guide[], max = 4): Guide[] {
  const candidates = pool.filter((g) => g.id !== current.id);
  const byId = new Map(candidates.map((g) => [g.id, g]));
  const picked: Guide[] = [];

  const push = (entry: Guide | undefined) => {
    if (!entry) return;
    if (picked.length >= max) return;
    if (picked.some((p) => p.id === entry.id)) return;
    picked.push(entry);
  };

  for (const ref of current.data.related) push(byId.get(ref.id));

  if (picked.length < max) {
    for (const g of sortByPublished(candidates.filter((g) => g.data.category === current.data.category))) {
      push(g);
    }
  }

  if (picked.length < max) {
    const tags = new Set(current.data.tags);
    const scored = candidates
      .map((g) => ({ g, score: g.data.tags.filter((t) => tags.has(t)).length }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || b.g.data.published.valueOf() - a.g.data.published.valueOf());
    for (const { g } of scored) push(g);
  }

  return picked;
}
