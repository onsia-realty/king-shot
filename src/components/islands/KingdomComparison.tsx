import { useEffect, useId, useRef, useState, type SubmitEvent } from 'react';
import { useLocale } from '../../lib/locale';
import { readApiJson, RateLimitError, rateLimitMessage } from '../../lib/api-response';
import { comparisonMetrics, summarizeRanking, compareRankings, type ComparisonBoard, type ComparisonSnapshot } from '../../lib/kingdom-comparison';
import type { SelectPlayer } from './PlayerDiscovery';

type Issue = 'unavailable' | 'timeout' | 'connection' | 'cancelled' | `rate_limited:${number}`;
type Side = { status: 'loading' } | { status: 'error'; issue: Issue } | { status: 'ready'; data: ComparisonSnapshot };
interface Comparison { kids: [number, number]; board: ComparisonBoard; sides: [Side, Side] }
const validKingdom = (value: string) => /^\d{1,5}$/.test(value.trim()) && Number(value) >= 1 && Number(value) <= 10000;
const validId = (value: string | null): value is string => typeof value === 'string' && /^\d{1,15}$/.test(value) && /[1-9]/.test(value);
const field = 'mt-2 w-full min-w-0 rounded-lg border border-border bg-bg px-3 py-3';

function Portrait({ src, name }: { src: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  let url: string | undefined;
  try {
    const parsed = new URL(src ?? '');
    if (parsed.protocol === 'https:' && !parsed.username && !parsed.password) url = parsed.href;
  } catch { /* Use the initial for missing or unsafe image URLs. */ }
  return <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-raised font-bold text-accent">
    {url && !failed ? <img src={url} alt="" width={40} height={40} loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover" onError={() => setFailed(true)} /> : Array.from(name.trim())[0] || '?'}
  </span>;
}

export default function KingdomComparison({ onSelect }: { onSelect: SelectPlayer }) {
  const { locale, t } = useLocale();
  const id = useId();
  const [left, setLeft] = useState('1622');
  const [right, setRight] = useState('1736');
  const [board, setBoard] = useState<ComparisonBoard>('personal_power');
  const [limit, setLimit] = useState(100);
  const [invalid, setInvalid] = useState(false);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const request = useRef<AbortController | null>(null);
  const timer = useRef<number | undefined>(undefined);

  function stopRequest() {
    request.current?.abort();
    request.current = null;
    window.clearTimeout(timer.current);
  }
  useEffect(() => () => stopRequest(), []);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    stopRequest();
    setComparison(null);
    if (!validKingdom(left) || !validKingdom(right)) { setInvalid(true); return; }
    setInvalid(false);
    const kids: [number, number] = [Number(left), Number(right)];
    const submittedBoard = board;
    const controller = new AbortController();
    request.current = controller;
    setComparison({ kids, board: submittedBoard, sides: [{ status: 'loading' }, { status: 'loading' }] });
    const timeout = window.setTimeout(() => {
      if (request.current !== controller) return;
      stopRequest();
      setComparison(current => current ? { ...current, sides: current.sides.map(side => side.status === 'loading' ? { status: 'error', issue: 'timeout' } : side) as [Side, Side] } : null);
    }, 35_000);
    timer.current = timeout;
    async function loadSide(kid: number, index: number) {
      let side: Side;
      try {
        const response = await fetch(`/api/kingdom-rankings/?kid=${kid}&board=${submittedBoard}`, { signal: controller.signal, headers: { Accept: 'application/json' } });
        const data = await readApiJson(response);
        if (!response.ok || data?.ok !== true || data.kid !== kid || data.board !== submittedBoard || !Array.isArray(data.rows)) {
          side = { status: 'error', issue: 'unavailable' };
        } else {
          side = { status: 'ready', data };
        }
      } catch (cause) {
        side = { status: 'error', issue: cause instanceof RateLimitError ? `rate_limited:${cause.retryAfterSeconds}` : 'connection' };
      }
      if (request.current !== controller || controller.signal.aborted) return;
      setComparison(current => {
        if (!current || request.current !== controller) return current;
        const sides: [Side, Side] = [...current.sides];
        sides[index] = side;
        return { ...current, sides };
      });
    }
    await Promise.all(kids.map(loadSide));
    window.clearTimeout(timeout);
    // Keep the identity until the next submit/unmount so queued React updates stay valid.
  }

  const loading = comparison?.sides.some(side => side.status === 'loading') ?? false;
  const numberLocale = locale === 'zh-TW' ? 'zh-TW' : locale === 'en' ? 'en-US' : 'ko-KR';
  const format = (value: number) => value.toLocaleString(numberLocale);
  const metric = (value: ComparisonBoard) => comparisonMetrics.find(item => item[0] === value)![locale === 'zh-TW' ? 3 : locale === 'en' ? 2 : 1];
  const summaries = comparison?.sides.map(side => summarizeRanking(side.status === 'ready' ? side.data.rows : null, limit));
  const balance = summaries ? compareRankings(summaries[0], summaries[1]) : null;
  const dirty = comparison && (Number(left) !== comparison.kids[0] || Number(right) !== comparison.kids[1] || board !== comparison.board);
  const issues = {
    unavailable: t('랭킹을 불러오지 못했습니다. 다시 조회해 주세요.', 'Rankings are unavailable. Please try again.', "無法載入排名，請重試。"),
    timeout: t('조회 시간이 초과되었습니다. 다시 조회해 주세요.', 'The request timed out. Please try again.', "查詢逾時，請重試。"),
    connection: t('조회 연결에 문제가 생겼습니다. 다시 시도해 주세요.', 'Unable to load rankings. Please try again.', "無法連線載入排名，請重試。"),
    cancelled: t('조회를 취소했습니다.', 'Lookup cancelled.', "已取消查詢。"),
  };

  return <div className="space-y-5">
    <div>
      <p className="text-xs font-bold tracking-widest text-accent">{t('무료 왕국 비교', 'FREE KINGDOM COMPARISON', "免費王國比較")}</p>
      <h2 className="mt-2 text-xl font-bold">{t('왕국 비교', 'Kingdom VS', "王國比較")}</h2>
      <p className="mt-2 text-sm text-muted">{t('각 왕국에서 선택한 지표의 상위 N명을 각각 합산합니다. 지표마다 대상 영주가 달라지며, 왕국 전체 합계가 아닙니다.', 'Each kingdom independently selects its top N governors for the chosen metric. Participants vary by metric; these are not whole-kingdom totals.', "依所選指標，分別加總各王國前 N 名領主的分數。不同指標的入榜領主可能不同，並非整個王國的總分。")}</p>
    </div>
    <form onSubmit={submit} noValidate className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {([[left, setLeft, 'A'], [right, setRight, 'B']] as const).map(([value, setValue, side]) => <label key={side} className="min-w-0 text-sm font-bold" htmlFor={`${id}-${side}`}>{t(`왕국 ${side}`, `Kingdom ${side}`, `王國 ${side}`)}
          <input id={`${id}-${side}`} value={value} onChange={event => setValue(event.target.value)} inputMode="numeric" maxLength={5} autoComplete="off" aria-invalid={invalid && !validKingdom(value)} aria-describedby={invalid ? `${id}-invalid` : `${id}-help`} className={`${field} font-mono text-lg`} />
        </label>)}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1 text-sm font-bold" htmlFor={`${id}-metric`}>{t('비교 지표', 'Comparison metric', "比較指標")}<select id={`${id}-metric`} value={board} onChange={event => setBoard(event.target.value as ComparisonBoard)} className={field}>{comparisonMetrics.map(([key, ko, en, zhTW]) => <option key={key} value={key}>{t(ko, en, zhTW)}</option>)}</select></label>
        <button type="submit" className="rounded-lg bg-accent px-6 py-3 font-bold text-on-accent hover:bg-accent-strong">{loading ? t('다시 비교', 'Restart comparison', "重新比較") : t('왕국 비교 조회', 'Compare kingdoms', "查詢王國比較")}</button>
        {loading && <button type="button" onClick={() => {
          stopRequest();
          setComparison(current => current ? { ...current, sides: current.sides.map(side => side.status === 'loading' ? { status: 'error', issue: 'cancelled' } : side) as [Side, Side] } : null);
        }} className="rounded-lg border border-border px-4 py-3 text-sm">{t('취소', 'Cancel', "取消")}</button>}
      </div>
      <p id={`${id}-help`} className="text-xs text-muted">{t('왕국 번호 1~10000 · 왕국이나 지표를 변경한 뒤 조회 버튼을 눌러 주세요.', 'Kingdom numbers 1–10000 · Submit after changing kingdoms or the metric.', "王國編號 1～10000 · 修改王國或指標後，請按查詢按鈕。")}</p>
      {invalid && <p id={`${id}-invalid`} role="alert" className="text-sm text-danger">{t('두 왕국 번호를 1~10000 사이의 숫자로 입력해 주세요.', 'Enter both kingdom numbers from 1 to 10000.', "請輸入兩個王國的編號，範圍為 1～10000。")}</p>}
    </form>
    <p role="status" aria-live="polite" className="text-sm text-muted">{loading ? t('두 왕국의 랭킹을 불러오고 있습니다…', 'Loading rankings for both kingdoms…', "正在載入兩個王國的排名…") : comparison ? t('조회가 끝났습니다. 각 왕국의 수집 인원과 상태를 확인해 주세요.', 'Lookup finished. Check the available counts and status for each kingdom.', "查詢完成。請確認各王國的已收集人數與狀態。") : t('조회 버튼을 누르면 비교 결과가 표시됩니다.', 'Submit to view the comparison.', "按下查詢按鈕即可查看比較結果。")}</p>
    {dirty && <p className="rounded-lg border border-accent/30 bg-accent/5 p-3 text-sm text-accent">{t('입력값이 변경되었습니다. 아래 결과는 마지막으로 조회한 왕국과 지표입니다.', 'Inputs have changed. Results below still show the last submitted kingdoms and metric.', "輸入內容已變更。下方仍顯示上次查詢的王國與指標。")}</p>}
    {comparison && summaries && balance && <div className="space-y-5">
      <section aria-labelledby={`${id}-summary`} className="rounded-2xl border border-border bg-linear-to-br from-accent/10 via-bg to-link/10 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 id={`${id}-summary`} className="font-bold">{metric(comparison.board)} · {t(`상위 ${limit}명 점수 비교`, `Top ${limit} score comparison`, `前 ${limit} 名分數比較`)}</h3>
          <label htmlFor={`${id}-limit`} className="flex items-center gap-2 text-xs text-muted">{t('비교 인원', 'Compare top', "比較人數")}<select id={`${id}-limit`} value={limit} onChange={event => setLimit(Number(event.target.value))} className="rounded-lg border border-border bg-bg px-3 py-2 text-text">{[10, 50, 100].map(count => <option key={count} value={count}>{t(`${count}명`, `${count} governors`, `${count} 人`)}</option>)}</select></label>
        </div>
        <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-2 text-center sm:gap-4">
          {comparison.kids.map((kid, index) => <div key={index} className={`min-w-0 ${index === 0 ? 'col-start-1' : 'col-start-3'}`} style={{ gridRow: 1 }}>
            <p className={`text-xl font-bold sm:text-3xl ${index === 0 ? 'text-accent' : 'text-link'}`}>{t('왕국', 'Kingdom', "王國")} {kid}</p>
            <p className="mt-3 text-xs text-muted">{t(`상위 ${limit}명 합계`, `Top ${limit} total`, `前 ${limit} 名合計`)}</p>
            <p className="mt-1 break-words font-mono text-lg font-bold tabular-nums [overflow-wrap:anywhere] sm:text-2xl">{summaries[index].total === null ? '—' : format(summaries[index].total!)}</p>
            <p className="mt-1 text-xs text-muted">{comparison.sides[index].status === 'ready' ? t(`합산 ${summaries[index].count}명 / ${limit}명`, `Summed ${summaries[index].count} / ${limit} governors`, `已加總 ${summaries[index].count}／${limit} 人`) : t('데이터 대기 또는 조회 불가', 'Pending or unavailable', "等待資料或無法查詢")}</p>
          </div>)}
          <span className="col-start-2 row-start-1 pt-1 font-mono font-bold text-muted">VS</span>
        </div>
        {balance.complete ? <div className="mt-5 space-y-3">
          {balance.leftPercent === null ? <><div className="h-3 rounded-full bg-border" aria-hidden="true" /><p className="text-center text-xs text-muted">{t('양쪽 합계가 모두 0입니다.', 'Both totals are zero.', "兩邊的合計皆為 0。")}</p></> : <>
            <div role="img" aria-label={t(`상위 ${limit}명 합계 비중: 왕국 ${comparison.kids[0]} ${balance.leftPercent.toFixed(1)}%, 왕국 ${comparison.kids[1]} ${(100 - balance.leftPercent).toFixed(1)}%`, `Share of top ${limit} totals: Kingdom ${comparison.kids[0]} ${balance.leftPercent.toFixed(1)}%, Kingdom ${comparison.kids[1]} ${(100 - balance.leftPercent).toFixed(1)}%`, `前 ${limit} 名合計占比：王國 ${comparison.kids[0]} ${balance.leftPercent.toFixed(1)}%，王國 ${comparison.kids[1]} ${(100 - balance.leftPercent).toFixed(1)}%`)} className="flex h-3 overflow-hidden rounded-full bg-border"><span className="bg-accent" style={{ width: `${balance.leftPercent}%` }} /><span className="flex-1 bg-link" /></div>
            <div className="flex justify-between text-xs tabular-nums"><span className="text-accent">{balance.leftPercent.toFixed(1)}%</span><span className="text-link">{(100 - balance.leftPercent).toFixed(1)}%</span></div>
          </>}
          <p className="text-center text-sm text-muted">{t('합계 차이', 'Absolute total gap', "合計差距")} <strong className="ml-2 font-mono text-text">{format(balance.gap!)}</strong></p>
        </div> : <p className="mt-5 rounded-lg bg-raised p-3 text-sm text-muted">{loading ? t('양쪽 데이터를 확인한 뒤 합계 차이를 표시합니다.', 'The total gap will appear once both sides are available.', "確認兩邊資料後才會顯示合計差距。") : t(`불완전한 비교: 한쪽 이상이 ${limit}명 미만이거나 조회되지 않았습니다. 확인된 인원만 합산하며, 비중과 합계 차이는 표시하지 않습니다.`, `Incomplete comparison: at least one side has fewer than ${limit} governors or is unavailable. Only available governors are summed; shares and the total gap are not shown.`, `比較資料不完整：至少一邊不足 ${limit} 人或無法查詢。僅加總已確認的人數，不顯示占比與合計差距。`)}</p>}
      </section>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        {comparison.sides.map((side, index) => {
          const summary = summaries[index];
          const captured = side.status === 'ready' && typeof side.data.captured_at === 'number' && Number.isFinite(side.data.captured_at) ? new Date(side.data.captured_at * 1000) : null;
          const capturedAt = captured && !Number.isNaN(captured.getTime()) ? captured : null;
          const issue = side.status === 'error' ? rateLimitMessage(side.issue, locale) ?? issues[side.issue as keyof typeof issues] : '';
          return <section key={index} aria-labelledby={`${id}-side-${index}`} aria-busy={side.status === 'loading'} className="min-w-0 rounded-xl border border-border bg-bg p-3 sm:p-4">
            <h3 id={`${id}-side-${index}`} className={`font-bold ${index === 0 ? 'text-accent' : 'text-link'}`}>{t('왕국', 'Kingdom', "王國")} {comparison.kids[index]} · {metric(comparison.board)}</h3>
            {side.status === 'loading' ? <p className="mt-3 text-sm text-muted">{t('랭킹을 불러오는 중…', 'Loading rankings…', "正在載入排名…")}</p> : side.status === 'error' ? <p role="alert" className="mt-3 text-sm text-danger">{issue}</p> : <>
              <p className="mt-2 text-xs text-muted">{t(`수집 ${side.data.rows.length}명 · 표시 ${summary.count}명`, `Captured ${side.data.rows.length} governors · Showing ${summary.count}`, `已收集 ${side.data.rows.length} 人 · 顯示 ${summary.count} 人`)}</p>
              <p className="mt-1 text-xs text-muted">{capturedAt ? <>{t('수집 시각 ', 'Captured ', "收集時間 ")}<time dateTime={capturedAt.toISOString()}>{capturedAt.toLocaleString(numberLocale, { timeZone: 'Asia/Seoul' })}</time>{t(' (한국 시간)', ' (KST)', "（韓國時間）")}</> : t('수집 시각 정보 없음', 'Capture time unavailable', "無收集時間資料")}</p>
              {summary.count === 0 ? <p className="mt-4 rounded-lg bg-raised p-3 text-sm text-muted">{t('수집된 랭킹이 없어 비교할 수 없습니다.', 'No captured rankings are available for comparison.', "尚無已收集的排名，無法比較。")}</p> : <ol className="mt-4 space-y-2" aria-label={t(`왕국 ${comparison.kids[index]} 상위 ${limit}명`, `Kingdom ${comparison.kids[index]} top ${limit}`, `王國 ${comparison.kids[index]} 前 ${limit} 名`)}>{summary.rows.map((row, rowIndex) => {
                const governorId = validId(row.governor_id) ? row.governor_id : null;
                const playerId = governorId ?? (validId(row.uid) ? row.uid : null);
                const name = row.nick_name || t('이름 정보 없음', 'Unnamed governor', "名稱不明");
                return <li key={`${row.rank}-${row.uid ?? rowIndex}`}><button type="button" disabled={!playerId} onClick={() => { if (playerId) onSelect(playerId, governorId ? 'governor_id' : 'uid'); }} aria-label={t(`${row.rank}위 ${name}${playerId ? ', 프로필과 장비 보기' : ', 조회 ID 없음'}`, `Rank ${row.rank}, ${name}${playerId ? ', view profile and gear' : ', lookup ID unavailable'}`, `第 ${row.rank} 名，${name}${playerId ? '，查看個人資料與裝備' : '，無查詢 ID'}`)} className={`grid w-full min-w-0 grid-cols-[1.75rem_2.5rem_minmax(0,1fr)] items-center gap-x-2 gap-y-1 rounded-lg border p-3 text-left enabled:hover:border-accent enabled:hover:bg-raised disabled:cursor-default ${row.rank <= 3 ? 'border-accent/25 bg-accent/5' : 'border-border'}`}>
                  <span className={`row-span-2 text-center font-mono font-bold ${row.rank <= 3 ? 'text-accent' : 'text-muted'}`}>{row.rank}</span>
                  <span className="row-span-2"><Portrait key={row.avatar_url} src={row.avatar_url} name={name} /></span>
                  <span className="min-w-0 break-words [overflow-wrap:anywhere]"><span className="font-bold">{name}</span>{row.alliance_abbr && <span className="ml-1 text-xs text-muted">[{row.alliance_abbr}]</span>}{!playerId && <span className="block text-xs text-muted">{t('조회 ID 없음', 'Lookup ID unavailable', "無查詢 ID")}</span>}</span>
                  <span className="col-start-3 break-words font-mono text-sm tabular-nums [overflow-wrap:anywhere]">{format(row.score)} <span className="font-sans text-xs text-muted">{t('점수', 'Score', "分數")}</span></span>
                </button></li>;
              })}</ol>}
            </>}
          </section>;
        })}
      </div>
    </div>}
  </div>;
}
