export class RateLimitError extends Error {
  constructor(public retryAfterSeconds = 0) {
    super(`rate_limited:${retryAfterSeconds}`);
    this.name = 'RateLimitError';
  }
}

export function retryAfterSeconds(response: Response): number {
  const value = response.headers.get('Retry-After')?.trim();
  if (!value) return 0;
  const seconds = /^\d+$/.test(value) ? Number(value)
    : /^[A-Za-z]{3},/.test(value) ? Math.ceil((Date.parse(value) - Date.now()) / 1000) : 0;
  return Number.isSafeInteger(seconds) && seconds > 0 ? seconds : 0;
}

// No retries: a WAF response can be HTML, empty, or JSON.
export async function readApiJson(response: Response) {
  if (response.status === 429) throw new RateLimitError(retryAfterSeconds(response));
  return response.json();
}

export function rateLimitMessage(code: string, locale: 'ko' | 'en'): string | undefined {
  const match = /^rate_limited(?::(\d+))?$/.exec(code);
  if (!match) return undefined;
  const seconds = Number(match[1] ?? 0);
  return locale === 'en'
    ? `Requests are temporarily limited. ${seconds > 0 ? `Please try again after ${seconds} seconds.` : 'Please try again later.'}`
    : `요청이 일시적으로 제한되었습니다. ${seconds > 0 ? `${seconds}초 후 다시 시도해 주세요.` : '잠시 후 다시 시도해 주세요.'}`;
}
