import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useLocale } from '../../lib/locale';
import { readApiJson, RateLimitError } from '../../lib/api-response';
import type { AllianceMapAlliance, AllianceMapCity, AllianceMapListResponse, AllianceMapPositionsResponse } from '../../lib/alliance-map';
import KingdomMapCanvas, { cityLevel, clusterFocus, type MapAlliance, type MapCity, type MapFocus } from './KingdomMapCanvas';

interface Props { kid: number; initialTag?: string; seedCity?: AllianceMapCity; onLookup: (uid: string) => void }
const bounds = { min: 0, max: 1200 };
const control = 'rounded-lg border border-border bg-raised px-3 py-2 text-sm disabled:opacity-40';
const field = 'min-w-0 w-full rounded-lg border border-border bg-bg px-3 py-3';
const BATCH_DELAY = 8000;
// Browser-session pacing is shared by the map tab and profile map, including remounts.
let nextBatchAt = 0;
let limitedUntil = 0;

function rememberLimit(error: RateLimitError) {
  limitedUntil = Math.max(limitedUntil, Date.now() + Math.max(8, error.retryAfterSeconds) * 1000);
  return limitedUntil;
}
function useRemaining(until: number) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    setNow(Date.now());
    if (until <= Date.now()) return;
    const timer = window.setInterval(() => {
      const time = Date.now(); setNow(time);
      if (time >= until) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [until]);
  return Math.max(0, Math.ceil((until - now) / 1000));
}
function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const abort = () => { window.clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
    const timer = window.setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
  });
}
function validCity(city: AllianceMapCity, kid: number) {
  return city && /^\d{1,15}$/.test(String(city.uid ?? '')) && /[1-9]/.test(String(city.uid))
    && city.kid === kid && typeof city.x === 'number' && typeof city.y === 'number'
    && Number.isFinite(city.x) && Number.isFinite(city.y) && city.x >= 0 && city.x <= 1200 && city.y >= 0 && city.y <= 1200;
}
function validBatch(data: AllianceMapPositionsResponse, kid: number, tag: string, offset: number) {
  return data && data.ok === true && data.kind === 'positions' && data.kid === kid && data.tag === tag
    && data.coverage === 'alliance_profiles' && data.bounds?.min === 0 && data.bounds?.max === 1200
    && data.alliance && typeof data.alliance.aid === 'string' && typeof data.alliance.abbr === 'string'
    && Array.isArray(data.cities) && data.cities.every(city => validCity(city, kid))
    && [data.roster_count, data.processed, data.failed, data.unlocated, data.outside_kingdom].every(n => Number.isSafeInteger(n) && n >= 0)
    && data.processed <= 5 && data.processed + offset <= data.roster_count
    && data.cities.length + data.failed + data.unlocated + data.outside_kingdom === data.processed
    && (data.next_offset === null ? offset + data.processed === data.roster_count
      : data.processed > 0 && data.next_offset === offset + data.processed && data.next_offset < data.roster_count);
}

export default function OfficialAllianceMap(props: Props) {
  if (!Number.isInteger(props.kid) || props.kid < 1 || props.kid > 10000) return null;
  // A changed kingdom/profile aborts and discards the previous request scope.
  return <AllianceMapScope key={JSON.stringify([props.kid, props.initialTag ?? '', props.seedCity?.uid, props.seedCity?.x, props.seedCity?.y])} {...props} />;
}

function AllianceMapScope({ kid, initialTag, seedCity, onLookup }: Props) {
  const { locale } = useLocale();
  const en = locale === 'en';
  const id = useId();
  const [tag, setTag] = useState(initialTag ?? '');
  const [options, setOptions] = useState<AllianceMapAlliance[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [retryUntil, setRetryUntil] = useState(0);
  const remaining = useRemaining(retryUntil);
  const request = useRef<AbortController | null>(null);
  async function loadAlliances() {
    if (request.current) return;
    if (Date.now() < limitedUntil) { setRetryUntil(limitedUntil); return; }
    const controller = new AbortController(); request.current = controller;
    let timedOut = false;
    const timer = window.setTimeout(() => { timedOut = true; controller.abort(); }, 45000);
    setLoading(true); setError(false); setRetryUntil(0);
    try {
      const response = await fetch(`/api/alliance-map/?kid=${kid}`, { signal: controller.signal, headers: { Accept: 'application/json' } });
      const data: AllianceMapListResponse = await readApiJson(response);
      if (request.current !== controller || controller.signal.aborted) return;
      if (!response.ok || !data.ok || data.kind !== 'alliances' || data.kid !== kid || !Array.isArray(data.alliances)) throw new Error('Invalid alliance response');
      setOptions(data.alliances);
    } catch (cause) {
      if (request.current !== controller || (controller.signal.aborted && !timedOut)) return;
      if (cause instanceof RateLimitError) setRetryUntil(rememberLimit(cause));
      else setError(true);
    } finally {
      window.clearTimeout(timer);
      if (request.current === controller) { request.current = null; setLoading(false); }
    }
  }
  useEffect(() => {
    // A known profile shows its seed without scanning its roster or fetching options.
    if (!initialTag && !seedCity) void loadAlliances();
    return () => { request.current?.abort(); request.current = null; };
  }, []);
  const currentTag = tag.trim();
  const seed = seedCity && validCity(seedCity, kid) && (!currentTag || currentTag === (seedCity.alliance_abbr ?? '').trim()) ? seedCity : undefined;
  return <section className="min-w-0 space-y-4" aria-label={en ? 'Alliance member location map' : '연맹원 위치 지도'}>
    <div>
      <h3 className="font-bold">{en ? 'Alliance member locations · not the whole kingdom' : '연맹원 위치 지도 · 전체 왕국 아님'}</h3>
      <p className="mt-1 text-sm text-muted">{en ? `Kingdom ${kid} · Profile coordinates · not live` : `왕국 ${kid} · 프로필 좌표 · 실시간 아님`}</p>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <div><label htmlFor={`${id}-options`} className="block text-sm font-bold">{en ? 'Official alliance list' : '공식 연맹 목록'}</label>
        <select id={`${id}-options`} className={`${field} mt-2`} value={options?.some(a => a.abbr === currentTag) ? currentTag : ''} onChange={e => setTag(e.target.value)} disabled={loading || !options?.length}>
          <option value="">{en ? 'Select an alliance' : '연맹 선택'}</option>
          {options?.map(a => <option key={a.aid} value={a.abbr}>[{a.abbr}] {a.name} · {a.member_count ?? '—'}</option>)}
        </select>
      </div>
      <div><label htmlFor={`${id}-tag`} className="block text-sm font-bold">{en ? 'Alliance tag (case-sensitive)' : '연맹 태그 직접 입력 (대소문자 구분)'}</label>
        <input id={`${id}-tag`} className={`${field} mt-2`} value={tag} onChange={e => setTag(e.target.value)} maxLength={32} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="ROK" aria-describedby={`${id}-help`} />
      </div>
    </div>
    <p id={`${id}-help`} className="text-xs text-muted">{en ? 'Only part of the alliance list may be available. Enter an exact tag for an alliance missing from the list, including outside the top 100.' : '연맹 목록은 일부만 제공될 수 있습니다. 상위 100위 밖 등 목록에 없는 연맹은 정확한 태그를 직접 입력하세요.'}</p>
    <button type="button" className={control} disabled={loading || remaining > 0} onClick={() => void loadAlliances()}>{loading ? (en ? 'Loading alliances…' : '연맹 목록 조회 중…') : options ? (en ? 'Reload alliance list' : '연맹 목록 다시 조회') : (en ? 'Load alliance list' : '연맹 목록 조회')}</button>
    {retryUntil > 0 && <p role="alert" className="text-sm text-danger">{en ? `Requests paused by rate limit. ${remaining > 0 ? `Retry manually in ${remaining}s.` : 'You can retry manually now.'}` : `요청 제한으로 중지했습니다. ${remaining > 0 ? `${remaining}초 후 버튼을 눌러 재시도하세요.` : '버튼을 눌러 다시 시도할 수 있습니다.'}`}</p>}
    {error && <p role="alert" className="text-sm text-danger">{en ? 'Could not load the alliance list. This does not mean the kingdom is empty. Retry or enter a tag manually.' : '연맹 목록을 불러오지 못했습니다. 왕국에 도시가 없다는 뜻이 아닙니다. 재시도하거나 태그를 직접 입력하세요.'}</p>}
    {options?.length === 0 && <p className="text-sm text-muted">{en ? 'The provider returned no alliance options. This does not establish kingdom coverage; try an exact tag.' : '공급자가 연맹 목록을 반환하지 않았습니다. 왕국 전체의 상태를 뜻하지 않습니다. 정확한 태그로 조회해 보세요.'}</p>}
    <PositionMap key={currentTag} kid={kid} tag={currentTag} seedCity={seed} onLookup={onLookup} />
  </section>;
}

type Status = 'idle' | 'running' | 'waiting' | 'paused' | 'complete' | 'error' | 'limited';
function PositionMap({ kid, tag, seedCity, onLookup }: Omit<Props, 'initialTag'> & { tag: string }) {
  const { locale } = useLocale();
  const en = locale === 'en';
  const id = useId();
  const [cities, setCities] = useState<AllianceMapCity[]>(seedCity ? [seedCity] : []);
  const [alliance, setAlliance] = useState<AllianceMapPositionsResponse['alliance'] | null>(null);
  const [counts, setCounts] = useState({ processed: 0, failed: 0, unlocated: 0, outside: 0, total: null as number | null });
  const [storageFailed, setStorageFailed] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [retryUntil, setRetryUntil] = useState(0);
  const remaining = useRemaining(retryUntil);
  const [selectedUID, setSelectedUID] = useState<string | null>(seedCity?.uid ?? null);
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [filter, setFilter] = useState('');
  const offset = useRef<number | null>(0);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => { request.current?.abort(); request.current = null; }, []);
  function pause() {
    request.current?.abort(); request.current = null; setStatus('paused');
  }
  async function resume() {
    if (!tag || request.current || offset.current === null) return;
    if (Date.now() < limitedUntil) { setRetryUntil(limitedUntil); setStatus('limited'); return; }
    const controller = new AbortController(); request.current = controller;
    const active = () => request.current === controller && !controller.signal.aborted;
    setRetryUntil(0); setStatus('running');
    let timedOut = false;
    try {
      while (offset.current !== null && active()) {
        // Recheck the shared gate after waiting: another visible map may have made a request.
        while (Date.now() < nextBatchAt && active()) {
          setStatus('waiting'); await wait(nextBatchAt - Date.now(), controller.signal);
        }
        if (!active()) return;
        if (Date.now() < limitedUntil) throw new RateLimitError(Math.ceil((limitedUntil - Date.now()) / 1000));
        const batchOffset: number = offset.current;
        nextBatchAt = Date.now() + BATCH_DELAY;
        setStatus('running');
        const timer = window.setTimeout(() => { timedOut = true; controller.abort(); }, 105000);
        let data: AllianceMapPositionsResponse;
        try {
          const params = new URLSearchParams({ kid: String(kid), tag, offset: String(batchOffset) });
          const response = await fetch(`/api/alliance-map/?${params}`, { signal: controller.signal, headers: { Accept: 'application/json' } });
          data = await readApiJson(response);
          if (!active()) return;
          if (!response.ok || !validBatch(data, kid, tag, batchOffset)) throw new Error('Invalid positions response');
        } finally { window.clearTimeout(timer); }
        if (!active()) return;
        nextBatchAt = Date.now() + BATCH_DELAY;
        setCities(previous => {
          const merged = new Map(previous.map(city => [city.uid, city]));
          for (const city of data.cities) merged.set(city.uid, { ...city, shield_active: null, burn_active: null });
          return [...merged.values()];
        });
        setAlliance(data.alliance);
        setCounts(previous => ({ processed: previous.processed + data.processed, failed: previous.failed + data.failed,
          unlocated: previous.unlocated + data.unlocated, outside: previous.outside + data.outside_kingdom, total: data.roster_count }));
        if (data.cities.length > 0 && data.stored === false) setStorageFailed(true);
        offset.current = data.next_offset;
        if (offset.current === null) setStatus('complete');
      }
    } catch (cause) {
      if (request.current !== controller || (controller.signal.aborted && !timedOut)) return;
      if (cause instanceof RateLimitError) { setRetryUntil(rememberLimit(cause)); setStatus('limited'); }
      else setStatus('error');
    } finally { if (request.current === controller) request.current = null; }
  }
  const filtered = useMemo(() => {
    const query = filter.trim().toLocaleLowerCase();
    return cities.filter(city => !query || `${city.nick_name ?? ''} ${city.alliance_abbr ?? ''}`.toLocaleLowerCase().includes(query));
  }, [cities, filter]);
  const selected = cities.find(city => city.uid === selectedUID) ?? null;
  const alliances = useMemo<MapAlliance[]>(() => alliance ? [{ ...alliance, city_count: cities.length }] : seedCity?.aid ? [{ aid: seedCity.aid, abbr: seedCity.alliance_abbr, city_count: 1 }] : [], [alliance, cities.length, seedCity]);
  const busy = status === 'running' || status === 'waiting';
  const stamps = cities.map(city => city.profile_cached_at).filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0);
  const stamp = (value: number) => new Date(value * 1000).toLocaleString(en ? 'en-US' : 'ko-KR', { timeZone: 'Asia/Seoul' });
  const count = (value: number) => value.toLocaleString(en ? 'en-US' : 'ko-KR');
  function choose(city: MapCity) { setSelectedUID(String(city.uid)); setFocus({ x: city.x, y: city.y, scale: 20 }); }
  return <div className="min-w-0 space-y-3">
    <div className="flex flex-wrap items-center gap-2">
      {busy ? <button type="button" className={control} onClick={pause}>{en ? 'Pause loading' : '불러오기 일시정지'}</button> : <button type="button" className={control} disabled={!tag || status === 'complete' || remaining > 0} onClick={() => void resume()}>{status === 'complete' ? (en ? 'Roster lookup complete' : '연맹원 조회 완료') : status === 'idle' ? (en ? 'Load alliance positions' : '연맹원 위치 불러오기') : (en ? 'Resume / retry manually' : '이어서 불러오기 / 수동 재시도')}</button>}
      {seedCity && <button type="button" className={control} onClick={() => { setFilter(''); choose(cities.find(city => city.uid === seedCity.uid) ?? seedCity); }}>{en ? 'To profile city' : '조회한 영주 위치로'}</button>}
      <button type="button" className={control} disabled={!filtered.length} onClick={() => { const next = clusterFocus(filtered); if (next) setFocus({ ...next }); }}>{en ? 'To loaded members' : '불러온 연맹원 위치로'}</button>
    </div>
    <p className="text-xs text-muted">{en ? 'Member locations load in order. You can pause and resume at any time.' : '연맹원 위치를 순서대로 불러옵니다. 일시정지 후 이어서 조회할 수 있습니다.'}</p>
    <div role="status" className="space-y-1 text-sm" aria-live="polite">
      <p>{en ? 'Checked' : '확인'} {count(counts.processed)} / {counts.total === null ? '—' : count(counts.total)} · {en ? 'Displayed cities (including profile)' : '표시 도시 (프로필 포함)'} {count(cities.length)}</p>
      {counts.total !== null && counts.total > 0 && <progress className="w-full" max={counts.total} value={counts.processed} aria-label={en ? 'Roster lookup progress' : '연맹원 조회 진행률'} />}
      <p>{en ? 'Failed' : '조회 실패'} {count(counts.failed)} · {en ? 'No coordinates' : '좌표 없음'} {count(counts.unlocated)} · {en ? 'Outside this kingdom' : '다른 왕국'} {count(counts.outside)}</p>
      {storageFailed && <p role="status" className="text-accent">{en ? 'Some positions could not be saved to the kingdom map. They remain visible in this view.' : '일부 좌표를 전체 지도에 저장하지 못했습니다. 현재 화면에서는 계속 볼 수 있습니다.'}</p>}
      <p className="text-muted">{status === 'running' ? (en ? 'Loading member locations…' : '연맹원 위치 조회 중…') : status === 'waiting' ? (en ? 'Waiting to load more members…' : '다음 연맹원 조회 대기 중…') : status === 'paused' ? (en ? 'Paused. Loaded cities remain visible.' : '일시정지했습니다. 불러온 도시는 계속 표시됩니다.') : status === 'complete' ? (en ? 'Finished checking this roster. Missing or failed profiles are not confirmed positions.' : '이 연맹 명단의 조회를 마쳤습니다. 실패하거나 좌표가 없는 프로필의 위치는 확인되지 않았습니다.') : status === 'idle' ? (en ? 'Member positions load only when you press the button.' : '버튼을 누르면 연맹원 위치 조회를 시작합니다.') : ''}</p>
    </div>
    {status === 'limited' && <p role="alert" className="text-sm text-danger">{en ? `Rate limited; automatic loading stopped. ${remaining > 0 ? `Retry manually in ${remaining}s.` : 'Press resume to retry.'}` : `요청 제한으로 자동 조회를 중지했습니다. ${remaining > 0 ? `${remaining}초 후 수동으로 재시도하세요.` : '이어서 불러오기 버튼을 눌러 재시도하세요.'}`}</p>}
    {status === 'error' && <p role="alert" className="text-sm text-danger">{en ? 'Could not finish loading member locations. Confirmed cities remain visible; unchecked members are not counted. Check the exact tag and retry. This does not mean the kingdom is empty.' : '연맹원 위치를 모두 불러오지 못했습니다. 확인한 도시는 유지하며 미확인 인원은 집계하지 않습니다. 태그를 확인하고 재시도하세요. 왕국이 비었다는 뜻이 아닙니다.'}</p>}
    <div className="space-y-1 text-xs text-muted">
      <p>{en ? 'Profile information saved at (KST): ' : '프로필 정보 저장 시각 (한국 시간): '}{stamps.length ? `${stamp(Math.min(...stamps))}${Math.min(...stamps) !== Math.max(...stamps) ? ` – ${stamp(Math.max(...stamps))}` : ''}` : (en ? 'Unavailable' : '정보 없음')}</p>
      <p>{en ? 'This is not when the location was verified. Recent moves may not be reflected yet.' : '위치 확인 시각은 아니며, 최근 이동이 아직 반영되지 않을 수 있습니다.'}</p>
      {selected && <p>{en ? 'Selected city profile information saved at (KST): ' : '선택한 도시 프로필 정보 저장 시각 (한국 시간): '}{selected.profile_cached_at == null ? (en ? 'Unavailable' : '정보 없음') : stamp(selected.profile_cached_at)}</p>}
    </div>
    <label htmlFor={`${id}-filter`} className="block text-sm font-bold">{en ? 'Filter loaded members by name or tag' : '불러온 연맹원 이름·태그 검색'}</label>
    <input id={`${id}-filter`} className={field} value={filter} onChange={e => { setFilter(e.target.value); setSelectedUID(null); }} placeholder={en ? 'Player name or alliance tag' : '닉네임 또는 연맹 태그'} />
    <KingdomMapCanvas cities={filtered} allCities={cities} alliances={alliances} bounds={bounds} initialFocus={seedCity ? { x: seedCity.x, y: seedCity.y, scale: 20 } : undefined} focus={focus} selected={selected} onSelect={city => setSelectedUID(String(city.uid))} onClose={() => setSelectedUID(null)} onLookup={city => onLookup(String(city.uid))} coverageLabel={en ? 'Full map area' : '전체 지도 영역'} preserveCameraOnUpdate />
    {!cities.length && <p className="text-sm text-muted">{en ? 'No confirmed coordinates are displayed yet. This is a partial alliance view, not evidence of an empty kingdom.' : '아직 표시할 확인된 좌표가 없습니다. 연맹 일부 정보이며 왕국이 비었다는 뜻이 아닙니다.'}</p>}
    <details className="rounded-xl border border-border p-3"><summary className="cursor-pointer font-bold">{en ? 'Loaded member list · keyboard selection' : '불러온 연맹원 목록 · 키보드로 선택'} ({filtered.length})</summary>
      {cities.length > 0 && !filtered.length && <p className="mt-3 text-sm text-muted">{en ? 'No loaded members match this filter.' : '검색어와 일치하는 연맹원이 없습니다.'}</p>}
      <ul className="mt-3 grid max-h-80 gap-2 overflow-y-auto sm:grid-cols-2">{filtered.map(city => <li key={city.uid}><button type="button" className="w-full rounded-lg border border-border p-3 text-left hover:border-accent" onClick={() => choose(city)}><span className="block break-words font-bold">{city.nick_name || (en ? 'Name unavailable' : '이름 정보 없음')} {city.alliance_abbr && `[${city.alliance_abbr}]`}</span><span className="mt-1 block text-xs text-muted">X: {city.x} · Y: {city.y} · {cityLevel(city)} · {en ? 'Power' : '전투력'} {city.power == null ? '—' : count(city.power)}</span></button></li>)}</ul>
    </details>
  </div>;
}
