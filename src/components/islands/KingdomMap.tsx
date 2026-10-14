import { useEffect, useMemo, useRef, useState, type SubmitEvent } from 'react';
import type { SelectPlayer } from './PlayerDiscovery';
import KingdomMapCanvas, { allianceColor, cityLevel, clusterFocus, type MapCity, type MapAlliance, type MapFocus } from './KingdomMapCanvas';

interface MapData {
  ok: boolean; kid: number; bounds: { min: number; max: number }; cities: MapCity[];
  alliances: MapAlliance[]; updated_at?: number | null; stats?: { location_updated_at?: number | null }; message?: string;
}
interface Props {
  playerKingdom?: string; playerLocation?: MapFocus; playerAid?: string; onSelect: SelectPlayer;
}
const field = 'min-w-0 w-full rounded-lg border border-border bg-bg px-3 py-3';
const control = 'rounded-lg border border-border bg-raised px-3 py-2 text-sm disabled:opacity-40';
const count = (value?: number | null) => value == null ? '정보 없음' : value.toLocaleString('ko-KR');

export default function KingdomMap({ playerKingdom, playerLocation, playerAid, onSelect }: Props) {
  const [kingdom, setKingdom] = useState(playerKingdom ?? '');
  const [data, setData] = useState<MapData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [alliance, setAlliance] = useState('');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<MapCity | null>(null);
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => { if (playerKingdom) setKingdom(playerKingdom); }, [playerKingdom]);
  useEffect(() => () => { request.current?.abort(); request.current = null; }, []);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    request.current?.abort();
    request.current = null;
    setLoading(false); setError('');
    const kid = kingdom.trim();
    if (!/^\d{1,5}$/.test(kid) || Number(kid) < 1 || Number(kid) > 10000) { setError('왕국 번호는 1~10000 사이의 숫자로 입력해 주세요.'); return; }
    const controller = new AbortController();
    request.current = controller;
    let timedOut = false;
    const timer = window.setTimeout(() => { timedOut = true; controller.abort(); }, 40_000);
    setLoading(true);
    try {
      const response = await fetch(`/api/map/?kid=${encodeURIComponent(kid)}`, { signal: controller.signal, headers: { Accept: 'application/json' } });
      const result: MapData = await response.json();
      if (controller.signal.aborted || request.current !== controller) return;
      if (!response.ok || !result.ok || !Array.isArray(result.cities) || !Array.isArray(result.alliances) || !result.bounds || !(result.bounds.max > result.bounds.min)) {
        setError(result.message && /[가-힣]/.test(result.message) ? result.message : '왕국 지도를 불러오지 못했습니다. 잠시 후 다시 조회해 주세요.'); return;
      }
      setData(result); setFilter(''); setAlliance(''); setPage(0); setSelected(null); setFocus(null);
    } catch {
      if (request.current === controller && (!controller.signal.aborted || timedOut)) setError(timedOut ? '지도 조회 시간이 초과되었습니다. 잠시 후 다시 조회해 주세요.' : '지도 연결에 문제가 생겼습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      window.clearTimeout(timer);
      if (request.current === controller) { request.current = null; setLoading(false); }
    }
  }

  const allCities = useMemo(() => (data?.cities ?? []).filter((city) => Number.isFinite(city.x) && Number.isFinite(city.y)), [data]);
  const cities = useMemo(() => allCities.filter((city) => {
    const q = filter.trim().toLocaleLowerCase();
    return (!alliance || String(city.aid) === alliance)
      && (!q || `${city.nick_name ?? ''} ${city.alliance_abbr ?? ''}`.toLocaleLowerCase().includes(q));
  }), [allCities, filter, alliance]);
  const alliances = useMemo(() => [...(data?.alliances ?? [])].sort((a, b) => (b.city_count ?? 0) - (a.city_count ?? 0)), [data]);
  const stamp = data?.stats?.location_updated_at ?? data?.updated_at;
  const updated = stamp == null ? null : new Date(stamp * 1000);
  const validTime = updated && !Number.isNaN(updated.getTime());
  const sameKingdom = data && String(data.kid) === playerKingdom;
  function choose(city: MapCity, jump = false) {
    setSelected(city);
    if (jump) setFocus({ x: city.x, y: city.y, scale: 20 });
  }
  function jumpAlliance(aid: string) {
    setAlliance(aid); setFilter(''); setPage(0); setSelected(null);
    const target = clusterFocus(allCities.filter((city) => !aid || String(city.aid) === aid));
    if (target) setFocus({ ...target });
  }
  function jumpResults() {
    if (cities.length === 1) choose(cities[0], true);
    else {
      const target = clusterFocus(cities);
      if (target) setFocus({ ...target });
    }
  }
  const allianceList = <ul className="space-y-1">{alliances.map((a) => <li key={a.aid}>
    <button type="button" aria-pressed={alliance === String(a.aid)} onClick={() => jumpAlliance(String(a.aid))}
      className={`w-full min-w-0 rounded-lg border px-3 py-2 text-left text-sm ${alliance === String(a.aid) ? 'border-accent bg-accent/10' : 'border-transparent hover:bg-raised'}`}>
      <span className="flex items-center gap-2"><span aria-hidden="true" className="size-3 shrink-0 rounded-sm" style={{ background: allianceColor(a.aid) }} /><span className="min-w-0 break-words font-bold">[{a.abbr || '약칭 없음'}]</span></span>
      <span className="mt-1 block break-words text-xs text-muted">{a.name || '이름 정보 없음'}</span>
      <span className="mt-1 block text-xs text-muted">도시 {count(a.city_count)}개</span>
    </button>
  </li>)}</ul>;

  return <div className="space-y-4">
    <form onSubmit={submit} noValidate aria-busy={loading}>
      <label htmlFor="map-kingdom" className="block font-bold">왕국 번호</label>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row"><input id="map-kingdom" className={`${field} flex-1`} value={kingdom} onChange={(e) => setKingdom(e.target.value)} inputMode="numeric" maxLength={5} placeholder="예: 1622" /><button disabled={loading} className="rounded-lg bg-accent px-5 py-3 font-bold text-on-accent disabled:opacity-60">{loading ? '지도 조회 중…' : '왕국 지도 조회'}</button></div>
    </form>
    <p role="status" className="text-sm text-muted">{loading ? '저장된 왕국 지도 데이터를 불러오고 있습니다.' : !data ? '왕국 번호를 입력하면 저장된 도시 위치를 확인할 수 있습니다.' : `왕국 ${data.kid} · 도시 ${data.cities.length.toLocaleString('ko-KR')}개 · 필터 결과 ${cities.length.toLocaleString('ko-KR')}개`}</p>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    {data && <>
      <div className="text-xs text-muted"><p>{validTime ? <>위치 데이터 갱신 시간 <time dateTime={updated.toISOString()}>{updated.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</time> (한국 시간)</> : '위치 데이터 갱신 시간 정보 없음'}</p><p className="mt-1">저장된 지도입니다. 현재 위치·보호막·연소 상태와 다를 수 있습니다.</p></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label htmlFor="city-filter" className="block text-sm font-bold">도시 이름 또는 연맹 약칭</label><div className="mt-2 flex gap-2"><input id="city-filter" className={field} value={filter} onChange={(e) => { setFilter(e.target.value); setPage(0); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); jumpResults(); } }} placeholder="닉네임 또는 연맹 약칭을 입력하세요" /><button type="button" disabled={!cities.length} className={`${control} shrink-0`} onClick={jumpResults}>이동</button></div></div>
        <div><label htmlFor="alliance-filter" className="block text-sm font-bold">연맹 선택 · 밀집 구역으로 이동</label><select id="alliance-filter" className={`${field} mt-2`} value={alliance} onChange={(e) => jumpAlliance(e.target.value)}><option value="">모든 연맹</option>{alliances.map((a) => <option key={a.aid} value={String(a.aid)}>[{a.abbr || '약칭 없음'}] {a.name || '이름 정보 없음'} · 도시 {a.city_count ?? 0}개</option>)}</select></div>
      </div>
      {sameKingdom && (playerLocation || playerAid) && <div className="flex flex-wrap gap-2">
        {playerLocation && <button type="button" className={control} onClick={() => { setFilter(''); setAlliance(''); setPage(0); setFocus({ ...playerLocation, scale: 20 }); }}>조회한 영주 위치</button>}
        {playerAid && <button type="button" className={control} onClick={() => jumpAlliance(playerAid)}>조회한 영주의 연맹</button>}
      </div>}
      <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_190px]">
        <KingdomMapCanvas cities={cities} allCities={allCities} alliances={alliances} bounds={data.bounds} initialFocus={sameKingdom ? playerLocation : undefined} focus={focus} selected={selected} onSelect={(city) => choose(city)} onClose={() => setSelected(null)} onLookup={(city) => onSelect(String(city.uid), 'uid')} />
        <aside className="hidden max-h-[620px] min-w-0 overflow-y-auto overscroll-contain rounded-xl border border-border bg-bg p-2 lg:block" aria-label="연맹 구역으로 이동"><h3 className="mb-2 px-2 text-sm font-bold">연맹 구역 ({alliances.length})</h3>{allianceList}</aside>
      </div>
      <details className="rounded-xl border border-border p-3 lg:hidden"><summary className="cursor-pointer text-sm font-bold">연맹 구역으로 이동 ({alliances.length}개 연맹)</summary><div className="mt-2 max-h-60 overflow-y-auto overscroll-contain">{allianceList}</div></details>
      <details className="rounded-xl border border-border p-3"><summary className="cursor-pointer font-bold">도시 목록 ({cities.length.toLocaleString('ko-KR')}개) · 키보드로 선택</summary>
        {cities.length === 0 && <p className="mt-3 text-sm text-muted">표시할 도시가 없습니다. 검색어와 연맹 선택을 확인해 주세요.</p>}
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">{cities.slice(page * 30, (page + 1) * 30).map((city) => <li key={city.uid}><button type="button" className="w-full min-w-0 rounded-lg border border-border p-3 text-left hover:border-accent hover:bg-raised" onClick={() => choose(city, true)}><span className="block break-words font-bold [overflow-wrap:anywhere]">{city.nick_name || '이름 정보 없음'} {city.alliance_abbr && `[${city.alliance_abbr}]`}</span><span className="mt-1 block text-xs text-muted">좌표 {city.x}, {city.y} · {cityLevel(city)} · 전투력 {count(city.power)}</span></button></li>)}</ul>
        {cities.length > 30 && <nav aria-label="도시 목록 페이지" className="mt-3 flex items-center justify-between gap-2 text-sm"><button type="button" className={control} disabled={page === 0} onClick={() => setPage(page - 1)}>이전</button><span>{page + 1} / {Math.ceil(cities.length / 30)}쪽</span><button type="button" className={control} disabled={(page + 1) * 30 >= cities.length} onClick={() => setPage(page + 1)}>다음</button></nav>}
      </details>
    </>}
  </div>;
}
