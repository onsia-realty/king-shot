import type { GiftCode } from '@/components/islands/GiftCodeTable';

/**
 * 기프트 코드의 상태 판정을 한곳에 모아 둔다.
 *
 * 예전에는 페이지가 `new Date().toISOString().slice(0, 10)` 로 빌드 시각 UTC 를 쓰고
 * scripts/sync-gift-codes.mjs 는 KST 를 써서 하루가 어긋날 수 있었다.
 * 기준은 KST 하나로 통일한다 — 한국어 사이트고, 자동 동기화도 KST 오전 9시에 돈다.
 */
export type GiftCodeStatus = '예정' | '활성' | '만료';

/** 'YYYY-MM-DD' (한국 시간). GitHub Actions 와 Vercel 빌드는 UTC 라서 못 믿는다. */
export function todayKST(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/**
 * 날짜가 아예 없으면 활성으로 본다. 기한을 모른다는 이유로 멀쩡한 코드를
 * 만료 표로 내려 버리면 안 되기 때문이고, 기존 동작이기도 하다.
 */
export function statusOf(code: GiftCode, today: string): GiftCodeStatus {
  if (code.startsAt && code.startsAt > today) return '예정';
  if (code.expiresAt && code.expiresAt < today) return '만료';
  return '활성';
}
