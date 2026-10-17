import { useCalculatorLocale } from '@/lib/calculator-locale';
import { useEffect, useState } from 'react';
import { CATEGORY_LABELS, CONFIDENCE_LABELS, KINGDOM_MAX, isoDate, localToday, predictUnlocks, type UnlockCategory, type UnlockItem } from '@/data/content-unlock';

const STORAGE_KEY = 'ks:content-unlock:kingdom';
const CATEGORIES: UnlockCategory[] = ['hero', 'gold', 'system', 'event'];
const COLORS = {
  hero: 'border-violet-400/30 bg-violet-400/10 text-violet-300',
  gold: 'border-amber-300/30 bg-amber-300/10 text-amber-200',
  system: 'border-sky-400/30 bg-sky-400/10 text-sky-300',
  event: 'border-rose-400/30 bg-rose-400/10 text-rose-300',
} as const;
const ICONS = { hero: '♛', gold: '◆', system: '⚙', event: '⚑' } as const;
const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent';
const fmtDate = (day: number) => isoDate(day).replaceAll('-', '.');

function CategoryIcon({ category }: { category: UnlockCategory }) {
  return <span aria-hidden="true" className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border text-2xl ${COLORS[category]}`}>{ICONS[category]}</span>;
}

export default function ContentUnlockPredictor() {
  const { t: ui, text: tx } = useCalculatorLocale();
  const [raw, setRaw] = useState('1200');
  // Never infer unlock status from the build machine's date.
  const [today, setToday] = useState<number | null>(null);
  const [category, setCategory] = useState<UnlockCategory | 'all'>('all');
  useEffect(() => {
    setToday(localToday());
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved !== null) setRaw(saved);
    } catch { /* Storage is optional. */ }
  }, []);
  function onChange(value: string) {
    setRaw(value);
    try { localStorage.setItem(STORAGE_KEY, value); } catch { /* Storage is optional. */ }
  }
  const normalized = raw.trim();
  const kingdom = Number(normalized.replace(/^k/i, ''));
  const valid = /^k?\d+$/i.test(normalized) && Number.isSafeInteger(kingdom) && kingdom >= 1;
  const prediction = valid ? predictUnlocks(kingdom, today ?? 0) : null;
  const upcoming = today === null ? [] : prediction?.items.filter(it => !it.isUnlocked) ?? [];
  const past = today === null ? [] : prediction?.items.filter(it => it.isUnlocked) ?? [];
  const next = upcoming[0];
  const matches = (it: UnlockItem) => category === 'all' || it.rule.category === category;
  const visibleUpcoming = upcoming.filter(matches);
  const visiblePast = past.filter(matches);
  const error = !valid ? ui('1 이상의 정수를 입력해 주세요. 예: 1622 또는 K1622', 'Enter a whole number of 1 or higher, e.g. 1622 or K1622.')
    : !prediction ? ui(`아직 데이터가 없는 왕국입니다. K1~K${KINGDOM_MAX}까지 지원합니다.`, `No data for this kingdom yet. K1–K${KINGDOM_MAX} are supported.`) : null;

  function card(it: UnlockItem, unlocked = false) {
    return <li key={it.rule.key} className={`relative rounded-2xl border p-4 sm:p-5 ${it === next ? 'border-accent/40 bg-accent/5' : 'border-border bg-surface'}`}>
      <span aria-hidden="true" className={`absolute -left-[1.85rem] top-9 h-2.5 w-2.5 rounded-full ring-4 ring-bg ${unlocked ? 'bg-muted' : 'bg-accent'}`} />
      <div className="flex items-start gap-3">
        <CategoryIcon category={it.rule.category} />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">{tx(CATEGORY_LABELS[it.rule.category])}</p>
          <h4 className="mt-0.5 font-bold sm:text-lg">{tx(it.rule.nameKo)}</h4>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <time dateTime={isoDate(it.unlockDay)} className="tabular-nums text-muted">{fmtDate(it.unlockDay)}</time>
            <span className={unlocked ? 'text-success' : 'font-bold text-accent-strong'}>{unlocked ? ui('해금됨', 'Unlocked') : `D-${it.daysRemaining}`}</span>
          </div>
        </div>
      </div>
      <details className="mt-3 border-t border-border/60 pt-3 text-xs text-muted">
        <summary className={`w-fit cursor-pointer rounded ${FOCUS}`}>{ui('예측 근거 · 신뢰도', 'Forecast details · confidence')} <span className="text-text">{tx(CONFIDENCE_LABELS[it.rule.confidence])}</span></summary>
        <p className="mt-2 leading-relaxed">{it.rule.notes ? tx(it.rule.notes) : ui('왕국 기준일과 콘텐츠 해금 규칙으로 계산한 예상 일정입니다.', 'Estimated from the kingdom reference date and content unlock rules.')}</p>
      </details>
    </li>;
  }

  return <div className="space-y-6">
    <section aria-labelledby="kingdom-heading" className="rounded-2xl border border-border bg-surface p-5 sm:p-7">
      <div className="grid gap-5 sm:grid-cols-2 sm:items-center">
        <div>
          <p className="text-xs font-bold tracking-widest text-accent">KINGDOM INTELLIGENCE</p>
          <h2 id="kingdom-heading" className="mt-2 text-xl font-bold">{ui('내 왕국의 다음 챕터', 'Your kingdom’s next chapter')}</h2>
          <p id="unlock-help" className="mt-2 text-sm text-muted">{ui('처음에는 예시 K1200을 보여 줍니다. 내 왕국을 입력하면 이 브라우저에 기억됩니다.', 'K1200 is the initial example. Enter your kingdom to remember it in this browser.')}</p>
        </div>
        <div>
          <label htmlFor="unlock-kingdom" className="mb-2 block text-sm font-semibold">{ui('왕국 번호', 'Kingdom number')}</label>
          <input id="unlock-kingdom" type="text" inputMode="numeric" autoComplete="off" spellCheck={false} placeholder="K1622" value={raw} onChange={e => onChange(e.target.value)} aria-invalid={!!error} aria-describedby={`unlock-help${error ? ' unlock-error' : ''}`} aria-controls="unlock-results"
            className={`w-full min-w-0 rounded-xl border border-accent/50 bg-bg px-4 py-3 text-3xl font-extrabold tabular-nums text-accent-strong placeholder:text-muted ${FOCUS}`} />
          <p className="mt-2 text-xs text-muted">K1–K{KINGDOM_MAX} · {ui('입력 즉시 계산', 'Updates as you type')}</p>
        </div>
      </div>
    </section>
    <p role="status" id="unlock-error" className={error ? 'rounded-xl border border-warning/40 bg-warning/5 p-4 text-sm text-warning' : 'sr-only'}>{error ?? (today === null ? ui('오늘 날짜를 확인하는 중…', 'Checking today’s date…') : ui(`K${kingdom}: 해금 ${past.length}개, 예정 ${upcoming.length}개`, `K${kingdom}: ${past.length} unlocked, ${upcoming.length} upcoming`))}</p>
    <div id="unlock-results" aria-busy={today === null} className="space-y-6">
      {prediction && <>
        <section aria-labelledby="next-unlock-heading" className="relative overflow-hidden rounded-2xl border border-accent/40 bg-gradient-to-br from-accent/15 via-surface to-bg p-6 sm:p-8">
          <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full border border-accent/10" />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-bold tracking-widest text-accent">K{prediction.kingdom} · {ui('다음 해금', 'NEXT UNLOCK')}</p>
              <div className="mt-4 flex items-center gap-3">
                {next && <CategoryIcon category={next.rule.category} />}
                <h2 id="next-unlock-heading" className="text-2xl font-extrabold sm:text-3xl">{today === null ? ui('일정을 준비하고 있어요', 'Preparing your timeline') : next ? tx(next.rule.nameKo) : ui('모든 콘텐츠 해금 완료', 'All content unlocked')}</h2>
              </div>
              {next ? <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                <time dateTime={isoDate(next.unlockDay)} className="rounded-full border border-accent/25 bg-bg/40 px-3 py-1 tabular-nums">{fmtDate(next.unlockDay)}</time>
                <span className="rounded-full border border-accent/25 bg-bg/40 px-3 py-1 text-accent-strong">{ui('신뢰도', 'Confidence')} · {tx(CONFIDENCE_LABELS[next.rule.confidence])}</span>
              </div> : <p className="mt-3 text-sm text-muted">{today === null ? ui('이 기기의 오늘 날짜를 확인 중입니다.', 'Checking the current date on this device.') : ui('등록된 모든 콘텐츠가 예상 해금일을 지났습니다.', 'All tracked content has reached its estimated unlock date.')}</p>}
            </div>
            {next && <div className="shrink-0 sm:text-right"><p className="text-6xl font-black tracking-tighter text-accent-strong tabular-nums sm:text-7xl">D-{next.daysRemaining}</p><p className="mt-2 text-sm text-muted">{ui('예상 해금까지', 'Until estimated unlock')}</p></div>}
          </div>
        </section>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-surface p-4"><dt className="text-xs text-muted">{ui('해금됨', 'Unlocked')}</dt><dd className="mt-1 text-2xl font-extrabold text-success">{today === null ? '—' : past.length}<span className="ml-1 text-sm font-normal text-muted">/ {prediction.items.length}</span></dd></div>
          <div className="rounded-xl border border-border bg-surface p-4"><dt className="text-xs text-muted">{ui('해금 예정', 'Upcoming')}</dt><dd className="mt-1 text-2xl font-extrabold text-accent-strong">{today === null ? '—' : upcoming.length}</dd></div>
          <div className="col-span-2 rounded-xl border border-border bg-surface p-4 sm:col-span-1"><dt className="text-xs text-muted">{ui('계산 기준일', 'Reference date')}</dt><dd className="mt-1 text-xl font-bold tabular-nums">{fmtDate(prediction.baseDay)}</dd></div>
        </dl>
        <details className="text-sm text-muted">
          <summary className={`w-fit cursor-pointer rounded ${FOCUS}`}>{ui('기준일과 예측 안내', 'Reference date & forecast notes')}</summary>
          <p className="mt-2">{prediction.group ? ui(`통합 그룹 K${prediction.group.start}~K${prediction.group.end} 기준 · 원래 시작일 ${fmtDate(prediction.startDay)}`, `Unified group K${prediction.group.start}–K${prediction.group.end} · Original start ${fmtDate(prediction.startDay)}`) : ui('왕국 시작일 기준', 'Based on the kingdom start date')}</p>
          <p className="mt-1">{ui('모든 날짜는 예측입니다. 실제 일정은 게임 내 공지를 확인하세요.', 'All dates are forecasts. Check in-game announcements for the actual schedule.')}</p>
          {today !== null && <p className="mt-1">{ui('오늘', 'Today')}: {fmtDate(today)} · {ui('이 기기 날짜 기준', 'Device local date')}</p>}
        </details>
        <div role="group" aria-label={ui('콘텐츠 분류', 'Content categories')} className="flex flex-wrap gap-2 border-t border-border pt-6">
          {(['all', ...CATEGORIES] as const).map(key => <button key={key} type="button" aria-pressed={category === key} aria-controls="unlock-timeline" onClick={() => setCategory(key)} className={`min-h-11 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${FOCUS} ${category === key ? 'border-accent bg-accent text-on-accent' : 'border-border bg-surface text-muted hover:border-accent/50 hover:text-text'}`}>
            {key !== 'all' && <span aria-hidden="true" className="mr-2">{ICONS[key]}</span>}{key === 'all' ? ui('전체', 'All') : tx(CATEGORY_LABELS[key])}
          </button>)}
        </div>
        <div id="unlock-timeline" className="space-y-6">
          <section aria-labelledby="upcoming-heading">
            <h3 id="upcoming-heading" className="mb-5 text-lg font-bold">{ui('다가오는 해금', 'On the horizon')} <span className="ml-2 text-sm font-normal text-accent">{today === null ? '—' : visibleUpcoming.length}</span></h3>
            {today === null ? <p className="rounded-xl border border-border p-5 text-sm text-muted">{ui('오늘 날짜 확인 후 해금 상태를 보여 드립니다.', 'Unlock status will appear once today’s date is available.')}</p> : visibleUpcoming.length ? <ol className="ml-2 space-y-3 border-l border-border pl-6">{visibleUpcoming.map(it => card(it))}</ol> : <p className="rounded-xl border border-dashed border-border bg-surface p-6 text-sm text-muted">{upcoming.length === 0 ? ui('남은 해금이 없습니다. 지난 콘텐츠를 아래에서 확인하세요.', 'No remaining unlocks. Explore past content below.') : ui('이 분류에는 예정된 해금이 없습니다. 다른 분류를 선택해 보세요.', 'No upcoming unlocks in this category. Try another filter.')}</p>}
          </section>
          {today !== null && <details className="rounded-2xl border border-border bg-surface/40 p-4 sm:p-5">
            <summary className={`cursor-pointer rounded font-semibold ${FOCUS}`}>{ui('지난 콘텐츠', 'Past content')} <span className="ml-2 text-sm font-normal text-muted">{visiblePast.length}</span></summary>
            {visiblePast.length ? <ol className="ml-2 mt-5 space-y-3 border-l border-border pl-6">{visiblePast.map(it => card(it, true))}</ol> : <p className="mt-4 text-sm text-muted">{ui('이 분류에는 해금된 콘텐츠가 없습니다.', 'No unlocked content in this category.')}</p>}
          </details>}
        </div>
      </>}
    </div>
  </div>;
}
