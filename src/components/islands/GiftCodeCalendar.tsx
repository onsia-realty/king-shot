import { useMemo, useState } from 'react';
import type { GiftCode } from '@/components/islands/GiftCodeTable';
import { statusOf, type GiftCodeStatus } from '@/lib/gift-codes';
import { useCopy } from '@/lib/copy';

interface Props {
  codes: GiftCode[];
  /**
   * 'YYYY-MM-DD'. 페이지가 todayKST() 로 넘긴다.
   * 아일랜드가 직접 new Date() 를 부르면 서버 렌더와 클라이언트 하이드레이션이
   * 자정 언저리에 어긋나 깜빡인다.
   */
  today: string;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** 격자 계산은 전부 UTC 로 한다. 로컬 타임존이 끼어들면 날짜가 하루씩 밀린다. */
function iso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** 연/월을 하나의 정수로 눌러 비교와 증감을 단순하게 만든다. */
function monthIndex(year: number, month: number): number {
  return year * 12 + month;
}

const DAY = 86_400_000;

const STATUS_CLASS: Record<GiftCodeStatus, string> = {
  예정: 'border-accent/50 text-accent',
  활성: 'border-success/50 text-success',
  만료: 'border-border text-muted',
};

export default function GiftCodeCalendar({ codes, today }: Props) {
  const { copy, copied, failed } = useCopy();

  /** 날짜가 붙은 코드만 격자에 놓을 수 있다. */
  const dated = useMemo(() => codes.filter((c) => c.startsAt), [codes]);
  const undated = useMemo(() => codes.filter((c) => !c.startsAt), [codes]);

  /** 시작일 기준으로 날짜 → 코드 목록. */
  const byDate = useMemo(() => {
    const map = new Map<string, GiftCode[]>();
    for (const c of dated) {
      const key = c.startsAt!;
      const list = map.get(key);
      if (list) list.push(c);
      else map.set(key, [c]);
    }
    return map;
  }, [dated]);

  /** 오늘 기준 활성이면서 기간이 다 있는 코드 — 격자에 옅은 띠로 깐다. */
  const bands = useMemo(
    () =>
      dated
        .filter((c) => c.expiresAt && statusOf(c, today) === '활성')
        .map((c) => ({ from: c.startsAt!, to: c.expiresAt! })),
    [dated, today]
  );

  const [todayY, todayM] = [Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1];
  const todayIdx = monthIndex(todayY, todayM);

  /**
   * 이동 가능한 범위. 시작일의 최소 월부터, 만료일까지 포함한 최대 월까지.
   * 오늘이 그 밖이어도 `오늘` 버튼이 죽으면 안 되니 오늘 달도 범위에 넣는다.
   */
  const [minIdx, maxIdx] = useMemo(() => {
    let lo = todayIdx;
    let hi = todayIdx;
    for (const c of dated) {
      for (const d of [c.startsAt, c.expiresAt]) {
        if (!d) continue;
        const i = monthIndex(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1);
        if (i < lo) lo = i;
        if (i > hi) hi = i;
      }
    }
    return [lo, hi];
  }, [dated, todayIdx]);

  /**
   * 첫 화면은 "코드가 실제로 있는 가장 최근 달". 이번 달에 코드가 있으면 이번 달.
   * 데이터가 몇 달 뒤처져 있어도 빈 격자로 열리지 않게 하려는 것이다.
   */
  const initialIdx = useMemo(() => {
    let latest: number | null = null;
    for (const key of byDate.keys()) {
      const i = monthIndex(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1);
      if (i === todayIdx) return todayIdx;
      if (latest === null || i > latest) latest = i;
    }
    return latest ?? todayIdx;
  }, [byDate, todayIdx]);

  const [cursor, setCursor] = useState(initialIdx);
  const [selected, setSelected] = useState<string | null>(null);

  const year = Math.floor(cursor / 12);
  const month = cursor % 12;

  /** 6주 42칸. 1일이 속한 주의 일요일부터 채운다. */
  const cells = useMemo(() => {
    const first = Date.UTC(year, month, 1);
    const start = first - new Date(first).getUTCDay() * DAY;
    return Array.from({ length: 42 }, (_, i) => {
      const ms = start + i * DAY;
      const date = iso(ms);
      return {
        date,
        day: new Date(ms).getUTCDate(),
        outside: new Date(ms).getUTCMonth() !== month,
        codes: byDate.get(date) ?? [],
        banded: bands.some((b) => date >= b.from && date <= b.to),
      };
    });
  }, [year, month, byDate, bands]);

  const goto = (idx: number) => {
    setCursor(idx);
    setSelected(null);
  };

  const selectedCodes = selected ? (byDate.get(selected) ?? []) : [];

  const copyButton = (code: string) => (
    <button
      type="button"
      onClick={() => copy(code)}
      className="shrink-0 rounded-md border border-border px-2 py-1 text-xs font-bold text-text transition-colors hover:border-accent/60 hover:text-accent"
    >
      {copied === code ? '복사됨' : failed === code ? '복사 실패' : '복사'}
    </button>
  );

  return (
    <div className="rounded-xl border border-border bg-surface p-3 sm:p-4">
      {/* 월 네비게이션 */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => goto(cursor - 1)}
          disabled={cursor <= minIdx}
          aria-label="이전 달"
          className="rounded-md border border-border px-2.5 py-1 text-sm font-bold text-text transition-colors hover:border-accent/60 hover:text-accent disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-border disabled:hover:text-text"
        >
          ‹
        </button>
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold tabular-nums sm:text-lg">
            {year}년 {month + 1}월
          </h3>
          <button
            type="button"
            onClick={() => goto(todayIdx)}
            disabled={cursor === todayIdx}
            className="rounded-md border border-border px-2 py-0.5 text-xs font-bold text-muted transition-colors hover:border-accent/60 hover:text-accent disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-border disabled:hover:text-muted"
          >
            오늘
          </button>
        </div>
        <button
          type="button"
          onClick={() => goto(cursor + 1)}
          disabled={cursor >= maxIdx}
          aria-label="다음 달"
          className="rounded-md border border-border px-2.5 py-1 text-sm font-bold text-text transition-colors hover:border-accent/60 hover:text-accent disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-border disabled:hover:text-text"
        >
          ›
        </button>
      </div>

      {/* 요일 헤더 */}
      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs font-bold text-muted">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1">
            {w}
          </div>
        ))}
      </div>

      {/* 날짜 격자 — 375px 에서도 7열을 지키려고 칸 내용은 최소 폭만 차지한다 */}
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((cell) => {
          const isToday = cell.date === today;
          const isSelected = cell.date === selected;
          const label =
            `${Number(cell.date.slice(0, 4))}년 ${Number(cell.date.slice(5, 7))}월 ` +
            `${Number(cell.date.slice(8, 10))}일, ` +
            (cell.codes.length > 0 ? `코드 ${cell.codes.length}개` : '코드 없음');

          return (
            <button
              key={cell.date}
              type="button"
              aria-label={label}
              aria-pressed={isSelected}
              onClick={() => setSelected(isSelected ? null : cell.date)}
              className={[
                'flex min-w-0 flex-col items-center gap-0.5 rounded-md border px-0.5 py-1 text-left transition-colors sm:min-h-[4.25rem] sm:items-stretch sm:px-1',
                cell.banded ? 'bg-accent/10' : 'bg-raised/40',
                isSelected
                  ? 'border-accent'
                  : isToday
                    ? 'border-accent/60'
                    : 'border-transparent hover:border-border',
                cell.outside ? 'opacity-35' : '',
              ].join(' ')}
            >
              <span
                className={[
                  'text-center text-[11px] tabular-nums sm:text-left sm:text-xs',
                  isToday ? 'font-extrabold text-accent' : 'text-muted',
                ].join(' ')}
              >
                {cell.day}
              </span>

              {/* 모바일: 점 하나로 줄인다. 상세 패널이 주 동선이다. */}
              {cell.codes.length > 0 && (
                <span className="flex justify-center gap-0.5 sm:hidden" aria-hidden="true">
                  <span className="size-1.5 rounded-full bg-accent" />
                </span>
              )}

              {/* 데스크톱: 코드 칩 2개까지, 넘치면 +N */}
              <span className="hidden w-full min-w-0 flex-col gap-0.5 sm:flex" aria-hidden="true">
                {cell.codes.slice(0, 2).map((c) => (
                  <span
                    key={c.code}
                    className="block truncate rounded bg-accent/20 px-1 font-mono text-[10px] leading-4 font-bold text-accent-strong"
                  >
                    {c.code}
                  </span>
                ))}
                {cell.codes.length > 2 && (
                  <span className="block px-1 text-[10px] leading-4 font-bold text-muted">
                    +{cell.codes.length - 2}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* 범례 */}
      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm bg-accent/25" aria-hidden="true" />
          지금 유효한 기간
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block size-2.5 rounded-sm border border-accent/60"
            aria-hidden="true"
          />
          오늘
        </span>
      </p>

      {/* 상세 패널 */}
      <div className="mt-3 border-t border-border pt-3">
        {!selected ? (
          <p className="py-3 text-center text-sm text-muted">
            날짜를 누르면 그 날 시작하는 코드를 여기에 펼칩니다.
          </p>
        ) : selectedCodes.length === 0 ? (
          <p className="py-3 text-center text-sm text-muted">
            <strong className="text-text tabular-nums">{selected}</strong> 에 시작하는 코드가 없습니다.
          </p>
        ) : (
          <>
            <h4 className="text-sm font-bold tabular-nums">
              {selected} — 코드 {selectedCodes.length}개
            </h4>
            <ul className="mt-2 space-y-2">
              {selectedCodes.map((c) => {
                const status = statusOf(c, today);
                return (
                  <li
                    key={c.code}
                    className="rounded-lg border border-border bg-raised/50 px-3 py-2.5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="rounded-md border border-border bg-raised px-2 py-1 font-mono text-sm font-bold text-accent-strong">
                        {c.code}
                      </code>
                      <span
                        className={[
                          'rounded-full border px-2 py-0.5 text-xs font-bold',
                          STATUS_CLASS[status],
                        ].join(' ')}
                      >
                        {status}
                      </span>
                      {copyButton(c.code)}
                    </div>
                    <p className="mt-1.5 text-xs text-muted tabular-nums">
                      {c.startsAt} ~ {c.expiresAt ?? '기한 미확인'}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">{c.rewards.trim() || '보상 미확인'}</p>
                    {c.note && <p className="mt-0.5 text-xs text-muted">{c.note}</p>}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      {/* 날짜가 없는 코드는 격자에 놓을 자리가 없다. 그렇다고 지워 버리면 안 된다. */}
      {undated.length > 0 && (
        <div className="mt-3 border-t border-border pt-3">
          <h4 className="text-sm font-bold">유효 기간이 확인되지 않은 코드</h4>
          <p className="mt-1 text-xs text-muted">
            출처에 기간 표기가 없어 달력에 놓지 못했습니다. 아직 교환될 수 있습니다.
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {undated.map((c) => (
              <li key={c.code} className="flex items-center gap-2">
                <code className="rounded-md border border-border bg-raised px-2 py-1 font-mono text-sm font-bold text-accent-strong">
                  {c.code}
                </code>
                {copyButton(c.code)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
