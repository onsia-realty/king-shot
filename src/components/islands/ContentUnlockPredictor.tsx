import { useEffect, useState } from 'react';
import {
  CATEGORY_LABELS,
  CONFIDENCE_LABELS,
  KINGDOM_MAX,
  isoDate,
  localToday,
  predictUnlocks,
} from '@/data/content-unlock';

/**
 * 콘텐츠 해금 예측. 왕국 번호를 넣으면 해금 예정일 표를 그린다.
 * 계산은 전부 src/data/content-unlock.ts 의 순수 함수로 브라우저에서 한다.
 *
 * "오늘"은 사용자 로컬 날짜라서 빌드(SSR) 시점엔 알 수 없다. 그래서 마운트 전에는
 * 해금일까지만 그리고 상태·남은 일수는 비워 둔다(하이드레이션 불일치 방지).
 */

const DEFAULT_KINGDOM = '1200';
const STORAGE_KEY = 'ks:content-unlock:kingdom';

const CONFIDENCE_BADGE = {
  high: 'border-border text-muted',
  medium: 'border-accent/50 text-accent-strong',
  low: 'border-warning/60 text-warning',
} as const;

function fmtDate(day: number): string {
  const [y, m, d] = isoDate(day).split('-');
  return `${y}.${m}.${d}`;
}

export default function ContentUnlockPredictor() {
  const [raw, setRaw] = useState(DEFAULT_KINGDOM);
  const [today, setToday] = useState<number | null>(null);

  useEffect(() => {
    setToday(localToday());
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setRaw(saved);
    } catch {
      // 저장소를 못 쓰는 환경(사생활 보호 모드 등)이면 예시 왕국으로 둔다.
    }
  }, []);

  function onChange(value: string) {
    setRaw(value);
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // 기억 못 해도 계산엔 지장 없다.
    }
  }

  const kingdom = Number(raw.trim().replace(/^k/i, ''));
  const valid = raw.trim() !== '' && Number.isInteger(kingdom) && kingdom >= 1;
  // 마운트 전엔 today가 없으니 아무 날짜로 계산하고 상태 열만 숨긴다. 해금일은 today와 무관하다.
  const prediction = valid ? predictUnlocks(kingdom, today ?? 0) : null;
  const next = today === null ? undefined : prediction?.items.find((it) => !it.isUnlocked);

  return (
    <div className="rounded-xl border border-border bg-surface/60 p-4 sm:p-5">
      <label className="mb-1.5 block text-sm font-semibold text-muted" htmlFor="unlock-kingdom">
        왕국 번호
      </label>
      <input
        id="unlock-kingdom"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="예: 1200"
        value={raw}
        onChange={(e) => onChange(e.target.value)}
        className="w-full max-w-xs rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text tabular-nums placeholder:text-muted"
      />

      <div className="mt-5 border-t border-border pt-5" aria-live="polite">
        {!valid ? (
          <p className="rounded-lg border border-border bg-bg px-3 py-4 text-center text-sm text-muted">
            1 이상의 왕국 번호를 넣어 주세요.
          </p>
        ) : !prediction ? (
          <p className="rounded-lg border border-border bg-bg px-3 py-4 text-center text-sm text-muted">
            K{kingdom}은 아직 데이터가 없습니다. 지금은 K1~K{KINGDOM_MAX}까지만 시작일을 알고 있어요.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-raised p-4">
                <p className="text-sm text-muted">K{prediction.kingdom} 계산 기준일</p>
                <p className="mt-1 text-xl font-extrabold tabular-nums text-accent-strong sm:text-2xl">
                  {fmtDate(prediction.baseDay)}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {prediction.group
                    ? `통합 그룹 K${prediction.group.start}~K${prediction.group.end} 기준 (원래 시작일 ${fmtDate(prediction.startDay)})`
                    : '왕국 시작일 기준'}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-raised p-4">
                <p className="text-sm text-muted">다음 해금</p>
                {today === null ? (
                  <p className="mt-1 text-xl font-extrabold text-muted sm:text-2xl">계산 중…</p>
                ) : next ? (
                  <>
                    <p className="mt-1 text-xl font-extrabold text-accent-strong sm:text-2xl">
                      {next.rule.nameKo}
                    </p>
                    <p className="mt-1 text-sm text-muted tabular-nums">
                      {fmtDate(next.unlockDay)} · {next.daysRemaining}일 남음
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-xl font-extrabold text-accent-strong sm:text-2xl">
                    전부 해금됨
                  </p>
                )}
              </div>
            </div>

            <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-bg">
              <table className="w-full border-collapse text-sm">
                <caption className="sr-only">K{prediction.kingdom} 콘텐츠 해금 예정일</caption>
                <thead>
                  <tr className="bg-raised text-left">
                    <th scope="col" className="px-4 py-3 font-bold whitespace-nowrap">콘텐츠</th>
                    <th scope="col" className="px-4 py-3 font-bold whitespace-nowrap">분류</th>
                    <th scope="col" className="px-4 py-3 font-bold whitespace-nowrap">신뢰도</th>
                    <th scope="col" className="px-4 py-3 text-right font-bold whitespace-nowrap">해금일</th>
                    <th scope="col" className="px-4 py-3 text-right font-bold whitespace-nowrap">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {prediction.items.map((it) => (
                    <tr
                      key={it.rule.key}
                      className={`border-t border-border ${
                        it === next ? 'bg-accent/10' : today !== null && it.isUnlocked ? 'text-muted' : ''
                      }`}
                    >
                      <th scope="row" className="px-4 py-3 text-left font-bold">
                        {it.rule.nameKo}
                        {it.rule.notes ? (
                          <p className="mt-0.5 text-xs font-normal text-muted">{it.rule.notes}</p>
                        ) : null}
                      </th>
                      <td className="px-4 py-3 whitespace-nowrap">{CATEGORY_LABELS[it.rule.category]}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs font-bold ${CONFIDENCE_BADGE[it.rule.confidence]}`}
                        >
                          {CONFIDENCE_LABELS[it.rule.confidence]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                        {fmtDate(it.unlockDay)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                        {today === null
                          ? '—'
                          : it.isUnlocked
                            ? '해금됨'
                            : `${it.daysRemaining}일 남음`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
