import { useEffect, useId, useRef, useState, type SubmitEvent } from 'react';
import { useLocale } from '../../lib/locale';
import { readApiJson, RateLimitError, rateLimitMessage } from '../../lib/api-response';
import type { SelectPlayer } from './PlayerDiscovery';

interface RankingRow {
  rank: number; uid: string | null; governor_id: string | null;
  nick_name: string; score: number; kid: number;
  alliance_abbr: string | null; avatar_url: string | null;
}
interface RankingResponse {
  ok: true; kid: number; board: 'mystic_trial'; captured_at: number | null; rows: RankingRow[];
}
type RankingError = 'invalid' | 'unavailable' | 'timeout' | 'connection' | `rate_limited:${number}`;
const validKingdom = (value: string) => /^\d{1,5}$/.test(value) && Number(value) >= 1 && Number(value) <= 10000;
const validId = (value: string | null): value is string => value !== null && /^\d{1,15}$/.test(value) && /[1-9]/.test(value);

function Portrait({ src, name }: { src: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  let safeUrl: string | undefined;
  try {
    const url = new URL(src ?? '');
    if (url.protocol === 'https:' && !url.username && !url.password) safeUrl = url.href;
  } catch { /* Missing or unsafe portraits use the initial below. */ }
  return <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-raised text-lg font-bold text-accent sm:size-12" aria-hidden="true">
    {safeUrl && !failed ? <img src={safeUrl} alt="" width={48} height={48} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="size-full object-cover" /> : <span>{Array.from(name.trim())[0] || '?'}</span>}
  </span>;
}

export default function KingdomRankings({ playerKingdom, onSelect }: { playerKingdom?: string; onSelect: SelectPlayer }) {
  const { locale, t } = useLocale();
  const id = useId();
  const [kingdom, setKingdom] = useState(playerKingdom && validKingdom(playerKingdom) ? playerKingdom : '1584');
  const edited = useRef(false);
  const [result, setResult] = useState<RankingResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<RankingError | null>(null);
  const [limit, setLimit] = useState(100);
  const request = useRef<AbortController | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!edited.current && playerKingdom && validKingdom(playerKingdom)) setKingdom(playerKingdom);
  }, [playerKingdom]);
  useEffect(() => () => {
    request.current?.abort();
    request.current = null;
    window.clearTimeout(timer.current);
  }, []);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    request.current?.abort();
    request.current = null;
    window.clearTimeout(timer.current);
    setLoading(false);
    setResult(null);
    setError(null);
    const value = kingdom.trim();
    if (!validKingdom(value)) { setError('invalid'); return; }
    const kid = Number(value);
    const controller = new AbortController();
    request.current = controller;
    let timedOut = false;
    const timeout = window.setTimeout(() => { timedOut = true; controller.abort(); }, 35_000);
    timer.current = timeout;
    setLoading(true);
    try {
      const response = await fetch(`/api/kingdom-rankings/?kid=${kid}`, { signal: controller.signal, headers: { Accept: 'application/json' } });
      const data = await readApiJson(response);
      if (request.current !== controller || controller.signal.aborted) return;
      if (!response.ok || !data?.ok || data.board !== 'mystic_trial' || data.kid !== kid || !Array.isArray(data.rows)) {
        setError('unavailable');
        return;
      }
      setResult(data);
    } catch (cause) {
      if (request.current === controller && (!controller.signal.aborted || timedOut)) {
        setError(cause instanceof RateLimitError ? `rate_limited:${cause.retryAfterSeconds}` : timedOut ? 'timeout' : 'connection');
      }
    } finally {
      window.clearTimeout(timeout);
      if (request.current === controller) { request.current = null; setLoading(false); }
    }
  }

  const numberLocale = locale === 'zh-TW' ? 'zh-TW' : locale === 'en' ? 'en-US' : 'ko-KR';
  const errors = {
    invalid: t('왕국 번호는 1~10000 사이의 숫자로 입력해 주세요.', 'Enter a kingdom number from 1 to 10000.', "請輸入 1～10000 的王國編號。"),
    unavailable: t('랭킹을 불러오지 못했습니다. 잠시 후 다시 조회해 주세요.', 'Rankings are unavailable. Please try again later.', "無法載入排名，請稍後重試。"),
    timeout: t('조회 시간이 초과되었습니다. 잠시 후 다시 조회해 주세요.', 'The request timed out. Please try again later.', "查詢逾時，請稍後重試。"),
    connection: t('조회 연결에 문제가 생겼습니다. 잠시 후 다시 시도해 주세요.', 'Unable to load rankings. Please try again later.', "無法連線載入排名，請稍後重試。"),
  };
  const errorText = error ? rateLimitMessage(error, locale) ?? errors[error as keyof typeof errors] : '';
  const rows = result?.rows.slice(0, 100) ?? [];
  // API timestamps are Unix seconds, as with the existing profile/map snapshots.
  const captured = typeof result?.captured_at === 'number' && Number.isFinite(result.captured_at)
    ? new Date(result.captured_at * 1000) : null;
  const capturedAt = captured && !Number.isNaN(captured.getTime()) ? captured : null;

  return <div className="space-y-5">
    <div className="rounded-xl border border-accent/25 bg-linear-to-br from-accent/10 to-bg p-4 sm:p-5">
      <p className="text-xs font-bold tracking-widest text-accent">{t('왕국 랭킹 · 상위 100', 'KINGDOM RANKINGS · TOP 100', "王國排名 · 前 100 名")}</p>
      <h2 className="mt-2 text-xl font-bold sm:text-2xl">{t('신비한 시련', 'Mystic Trial', "神秘試煉")}</h2>
      <p className="mt-2 text-sm text-muted">{t('영주를 선택하면 프로필과 공개된 장비를 확인할 수 있습니다.', 'Select a governor to view their profile and public gear.', "選擇領主即可查看個人資料及公開裝備。")}</p>
    </div>
    <form onSubmit={submit} noValidate>
      <label htmlFor={`${id}-kingdom`} className="block text-sm font-bold">{t('왕국 번호', 'Kingdom number', "王國編號")}</label>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        <input id={`${id}-kingdom`} name="kid" value={kingdom} onChange={event => { edited.current = true; setKingdom(event.target.value); }} inputMode="numeric" autoComplete="off" maxLength={5} aria-invalid={error === 'invalid'} aria-describedby={`${id}-help${error === 'invalid' ? ` ${id}-error` : ''}`} className="min-w-0 flex-1 rounded-lg border border-border bg-bg px-4 py-3 font-mono text-lg" />
        <button type="submit" className="rounded-lg bg-accent px-6 py-3 font-bold text-on-accent hover:bg-accent-strong">{loading ? t('다시 조회', 'Restart lookup', "重新查詢") : t('랭킹 조회', 'Load rankings', "查詢排名")}</button>
      </div>
      <p id={`${id}-help`} className="mt-2 text-xs text-muted">{t('1~10000 · 조회 버튼을 누르면 해당 왕국의 상위 100명을 불러옵니다.', '1–10000 · Submit to load the top 100 governors in that kingdom.', "1～10000 · 按下查詢按鈕，即可載入該王國前 100 名領主。")}</p>
    </form>
    <p role="status" aria-live="polite" aria-atomic="true" className="text-sm text-muted">{loading
      ? t('신비한 시련 랭킹을 불러오고 있습니다…', 'Loading Mystic Trial rankings…', "正在載入神秘試煉排名…")
      : result ? t(`왕국 ${result.kid} · 상위 100 중 ${rows.length}명 · ${Math.min(limit, rows.length)}명 표시`, `Kingdom ${result.kid} · ${rows.length} of top 100 available · Showing ${Math.min(limit, rows.length)}`, `王國 ${result.kid} · 前 100 名中已取得 ${rows.length} 人 · 顯示 ${Math.min(limit, rows.length)} 人`)
        : error ? '' : t('왕국 번호를 입력하고 랭킹을 조회해 주세요.', 'Enter a kingdom number and load its rankings.', "請輸入王國編號並查詢排名。")}</p>
    {errorText && <p id={`${id}-error`} role="alert" className="rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">{errorText}</p>}
    <div aria-busy={loading}>
      {result && <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <p className="text-xs text-muted">{capturedAt ? <>{t('수집 시각 ', 'Captured ', "收集時間 ")}<time dateTime={capturedAt.toISOString()}>{capturedAt.toLocaleString(numberLocale, { timeZone: 'Asia/Seoul' })}</time>{t(' (한국 시간)', ' (KST)', "（韓國時間）")}</> : t('수집 시각 정보 없음', 'Capture time unavailable', "無收集時間資料")}</p>
          {rows.length > 10 && <label className="flex items-center gap-2 text-xs text-muted" htmlFor={`${id}-limit`}>{t('표시 인원', 'Show', "顯示人數")}
            <select id={`${id}-limit`} value={limit} onChange={event => setLimit(Number(event.target.value))} className="rounded-lg border border-border bg-bg px-3 py-2 text-text">{[10, 50, 100].map(count => <option key={count} value={count}>{t(`${count}명`, `${count} governors`, `${count} 人`)}</option>)}</select>
          </label>}
        </div>
        {rows.length === 0 ? <p className="rounded-xl bg-raised p-5 text-sm text-muted">{t('이 왕국의 신비한 시련 랭킹이 없습니다. 다른 왕국 번호로 조회해 주세요.', 'No Mystic Trial rankings are available for this kingdom. Try another kingdom number.', "此王國尚無神秘試煉排名，請改用其他王國編號查詢。")}</p> : <ol aria-label={t('신비한 시련 상위 100', 'Mystic Trial top 100', "神秘試煉前 100 名")} className="space-y-2">
          {rows.slice(0, limit).map((row, index) => {
            const governorId = validId(row.governor_id) ? row.governor_id : null;
            const playerId = governorId ?? (validId(row.uid) ? row.uid : null);
            const name = row.nick_name || t('이름 정보 없음', 'Unnamed governor', "名稱不明");
            const topThree = row.rank >= 1 && row.rank <= 3;
            return <li key={`${row.rank}-${row.uid ?? row.governor_id ?? index}`}>
              <button type="button" disabled={!playerId} onClick={() => { if (playerId) onSelect(playerId, governorId ? 'governor_id' : 'uid'); }} aria-label={t(`${row.rank}위 ${name}${playerId ? ', 프로필과 장비 보기' : ', 조회 ID 없음'}`, `Rank ${row.rank}, ${name}${playerId ? ', view profile and gear' : ', lookup ID unavailable'}`, `第 ${row.rank} 名，${name}${playerId ? '，查看個人資料與裝備' : '，無查詢 ID'}`)} className={`grid w-full min-w-0 grid-cols-[2rem_2.75rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1 rounded-xl border p-3 text-left transition-colors sm:grid-cols-[2.5rem_3rem_minmax(0,1fr)_auto] sm:p-4 ${topThree ? 'border-accent/30 bg-accent/5' : 'border-border bg-bg'} enabled:hover:border-accent enabled:hover:bg-raised disabled:cursor-default`}>
                <span className={`row-span-2 text-center font-mono text-lg font-bold sm:row-span-1 ${topThree ? 'text-accent' : 'text-muted'}`}>{row.rank}</span>
                <span className="row-span-2 sm:row-span-1"><Portrait key={row.avatar_url} src={row.avatar_url} name={name} /></span>
                <span className="min-w-0"><span className="block break-words font-bold [overflow-wrap:anywhere]">{name}</span>{row.alliance_abbr && <span className="block break-words text-xs text-muted [overflow-wrap:anywhere]">[{row.alliance_abbr}]</span>}{!playerId && <span className="block text-xs text-muted">{t('조회 ID 없음', 'Lookup ID unavailable', "無查詢 ID")}</span>}</span>
                <span className="col-start-3 flex flex-wrap items-baseline gap-x-2 sm:col-start-auto sm:block sm:text-right"><span className={`font-mono font-bold tabular-nums ${topThree ? 'text-accent' : 'text-text'}`}>{row.score.toLocaleString(numberLocale)}</span><span className="text-xs text-muted sm:block">{t('점수', 'Score', "分數")}</span></span>
              </button>
            </li>;
          })}
        </ol>}
      </div>}
    </div>
  </div>;
}
