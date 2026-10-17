import { useLocale } from '../../lib/locale';
import { readApiJson, RateLimitError } from '../../lib/api-response';
import { playerText, playerNumberLocale, playerError } from '../../lib/player-localization';
import { useEffect, useRef, useState, type SubmitEvent } from 'react';

export type PlayerIdType = 'governor_id' | 'uid';
export type SelectPlayer = (id: string, type: PlayerIdType) => void;
interface SearchPlayer {
  uid: number | string; fid?: number | string | null; nick_name?: string;
  kid?: number; power?: number; town_center_level?: number; x?: number; y?: number;
  alliance_abbr?: string; alliance_name?: string; avatar_url?: string;
}
interface SearchResponse { ok: boolean; query?: string; results?: SearchPlayer[]; total?: number; message?: string }
const field = 'min-w-0 w-full rounded-lg border border-border bg-bg px-4 py-3';
const button = 'rounded-lg bg-accent px-5 py-3 font-bold text-on-accent disabled:opacity-60';

export default function PlayerDiscovery({ onSelect }: { onSelect: SelectPlayer }) {
  const { locale } = useLocale();
  const tr = (text: string) => playerText(text, locale);
  const [query, setQuery] = useState('');
  const [kingdom, setKingdom] = useState('');
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => { request.current?.abort(); request.current = null; }, []);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    request.current?.abort();
    request.current = null;
    setLoading(false);
    setError('');
    setResult(null);
    const q = query.trim();
    const kid = kingdom.trim();
    if (q.length < 2 || q.length > 80) { setError('닉네임이나 검색어를 2~80자로 입력해 주세요.'); return; }
    if (kid && (!/^\d{1,5}$/.test(kid) || Number(kid) < 1 || Number(kid) > 10000)) { setError('왕국 번호는 1~10000 사이의 숫자로 입력해 주세요.'); return; }
    const controller = new AbortController();
    request.current = controller;
    let timedOut = false;
    const timer = window.setTimeout(() => { timedOut = true; controller.abort(); }, 40_000);
    setLoading(true);
    try {
      const params = new URLSearchParams({ q });
      if (kid) params.set('kid', kid);
      const response = await fetch(`/api/search/?${params}`, { signal: controller.signal, headers: { Accept: 'application/json' } });
      const data: SearchResponse = await readApiJson(response);
      if (controller.signal.aborted || request.current !== controller) return;
      if (!response.ok || !data.ok || !Array.isArray(data.results)) {
        setError(data.message || '검색 결과를 불러오지 못했습니다. 잠시 후 다시 검색해 주세요.');
        return;
      }
      setResult(data);
      setPage(0);
    } catch (error) {
      if (request.current === controller && (!controller.signal.aborted || timedOut)) setError(error instanceof RateLimitError ? error.message : timedOut ? '검색 시간이 초과되었습니다. 잠시 후 다시 검색해 주세요.' : '검색 연결에 문제가 생겼습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      window.clearTimeout(timer);
      if (request.current === controller) { request.current = null; setLoading(false); }
    }
  }

  const rows = result?.results ?? [];
  return <div className="space-y-4">
    <form onSubmit={submit} noValidate aria-busy={loading} className="space-y-4">
      <div><label htmlFor="nickname-search" className="block font-bold">{tr("닉네임 또는 검색어")}</label><input id="nickname-search" className={`${field} mt-2`} value={query} onChange={(e) => setQuery(e.target.value)} maxLength={80} placeholder={tr("닉네임을 입력하세요")} autoComplete="off" /></div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end"><div className="min-w-0 flex-1"><label htmlFor="search-kingdom" className="block text-sm font-bold">{tr("왕국 번호 (선택)")}</label><input id="search-kingdom" className={`${field} mt-2`} inputMode="numeric" maxLength={5} value={kingdom} onChange={(e) => setKingdom(e.target.value)} placeholder={tr("예: 1622 · 비우면 전체 왕국")} /></div><button className={button} disabled={loading}>{loading ? tr("검색 중…") : tr("닉네임 검색")}</button></div>
      <p className="text-sm text-muted">{tr("왕국 지정 시 지도 스냅샷의 닉네임을 검색해 최대 100명을 표시합니다. 전체 왕국 검색은 제공처의 결과 수 제한으로 누락될 수 있습니다.")}</p>
    </form>
    <p role="status" className="text-sm text-muted">{loading ? tr("닉네임을 검색하고 있습니다.") : result ? `${tr("검색 결과 ")}${(result.total ?? rows.length).toLocaleString(playerNumberLocale())}${tr("명 · 표시 가능한 결과 ")}${rows.length.toLocaleString(playerNumberLocale())}${tr("명")}` : tr("검색어를 입력하면 영주 목록이 표시됩니다.")}</p>
    {error && <p role="alert" className="text-sm text-danger">{playerError(error, locale)}</p>}
    {result && rows.length === 0 && <p className="rounded-lg bg-raised p-4 text-muted">{tr("검색된 영주가 없습니다. 검색어를 줄이거나 왕국 번호를 비워 다시 검색해 주세요.")}</p>}
    <ul className="space-y-2">{rows.slice(page * 30, (page + 1) * 30).map((player) => <li key={`${player.uid}-${player.kid}`}><button type="button" onClick={() => {
      const fid = String(player.fid ?? '');
      onSelect(/^[0-9]+$/.test(fid) && Number(fid) > 0 ? fid : String(player.uid), /^[0-9]+$/.test(fid) && Number(fid) > 0 ? 'governor_id' : 'uid');
    }} className="w-full min-w-0 rounded-xl border border-border p-4 text-left hover:border-accent hover:bg-raised">
      <span className="block break-words font-bold [overflow-wrap:anywhere]">{player.nick_name || tr("이름 정보 없음")}</span>
      <span className="mt-1 block break-words text-sm text-muted">{tr("왕국 ")}{player.kid ?? tr("정보 없음")} · {player.alliance_abbr ? `[${player.alliance_abbr}] ` : ''}{player.alliance_name || tr("연맹 정보 없음")}</span>
      <span className="mt-1 block text-sm">{tr("전투력 ")}{player.power == null ? tr("정보 없음") : Number(player.power).toLocaleString(playerNumberLocale())}</span>
    </button></li>)}</ul>
    {rows.length > 30 && <nav aria-label={tr("검색 결과 페이지")} className="flex items-center justify-between gap-2 text-sm"><button type="button" disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded-lg border border-border px-3 py-2 disabled:opacity-40">{tr("이전")}</button><span>{page + 1} / {Math.ceil(rows.length / 30)}{tr("쪽")}</span><button type="button" disabled={(page + 1) * 30 >= rows.length} onClick={() => setPage(page + 1)} className="rounded-lg border border-border px-3 py-2 disabled:opacity-40">{tr("다음")}</button></nav>}
  </div>;
}
