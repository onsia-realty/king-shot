export type VisitCounts = { today: number; total: number; date: string };

export async function fetchVisits(record = false): Promise<VisitCounts | null> {
  try {
    // Never retry POST: a lost response may already have committed the increment.
    const response = await fetch('/api/visits/', {
      method: record ? 'POST' : 'GET', credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (!data.ok) return null;
    if (!Number.isSafeInteger(data.today) || data.today < 0
      || !Number.isSafeInteger(data.total) || data.total < 0 || typeof data.date !== 'string') return null;
    return { today: data.today, total: data.total, date: data.date };
  } catch { /* A counter failure must not interrupt page use. */ }
  return null;
}

export async function updateVisitCounter(record = false) {
  const counts = await fetchVisits(record);
  for (const field of ['today', 'total'] as const) {
    document.querySelectorAll(`[data-visits-${field}]`).forEach(element => {
      element.textContent = counts ? counts[field].toLocaleString('ko-KR') : '—';
    });
  }
}

export function startVisitCounter() {
  void updateVisitCounter(true);
  // Only the homepage needs display refreshes; timers must never record a page access.
  if (!document.querySelector('[data-visits-today]')) return;
  const day = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  let lastDay = day();
  let timer: ReturnType<typeof setTimeout>;
  const schedule = () => {
    clearTimeout(timer);
    const shifted = Date.now() + 9 * 3600000;
    timer = setTimeout(refresh, 86400000 - shifted % 86400000 + 100);
  };
  const refresh = () => {
    if (document.visibilityState !== 'hidden') {
      lastDay = day();
      void updateVisitCounter();
    }
    schedule();
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && day() !== lastDay) refresh();
  });
  schedule();
}
