import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useLocale } from '../../lib/locale';
import { retryAfterSeconds } from '../../lib/api-response';
import { locationTimestamp, parseMapSnapshot, type MapSnapshot } from '../../lib/map-refresh';
import MapRefresh from './MapRefresh';
import OfficialAllianceMap from './OfficialAllianceMap';
import KingdomMapCanvas, { allianceColor, type MapAlliance, type MapCity, type MapFocus } from './KingdomMapCanvas';

interface Props { kid: number; initialFocus?: MapFocus; selectedUID?: string; onLookup: (uid: string) => void }
type StoredMap = MapSnapshot;
type Issue = 'not_collected' | 'storage' | 'limited' | 'failed';
export class StoredMapError extends Error {
  constructor(public issue: Issue, public queued = false, public retryAfter = 0) { super(issue); }
}
const control = 'rounded-lg border border-border bg-raised px-3 py-2 text-sm disabled:opacity-40';
const field = 'mt-2 w-full min-w-0 rounded-lg border border-border bg-bg px-3 py-3';
export const allianceKey = (aid: MapCity['aid']) => aid == null || String(aid) === '0' || aid === '' ? 'none' : String(aid);

export async function fetchStoredMap(kid: number, signal: AbortSignal, reload = false): Promise<StoredMap> {
  const response = await fetch(`/api/map/?kid=${kid}${reload ? '&fresh=1' : ''}`, {
    method: 'GET', signal, cache: reload ? 'no-store' : 'default', headers: { Accept: 'application/json' },
  });
  // These statuses may have HTML or empty bodies from an intermediary.
  if (response.status === 429) throw new StoredMapError('limited', false, retryAfterSeconds(response));
  if (response.status === 503) throw new StoredMapError('storage');
  const data = await response.json().catch(() => null);
  if (response.status === 202 || data?.error === 'not_collected') {
    throw new StoredMapError('not_collected', data?.kid === kid && data?.queued === true);
  }
  if (!response.ok) throw new StoredMapError('failed');
  try { return parseMapSnapshot(data, kid); }
  catch { throw new StoredMapError('failed'); }
}

// Counts come from the plotted cities, never a possibly stale alliance city_count.
export function storedAllianceGroups(cities: MapCity[], alliances: MapAlliance[]) {
  const metadata = new Map(alliances.map(alliance => [allianceKey(alliance.aid), alliance]));
  const groups = new Map<string, MapAlliance & { city_count: number }>();
  for (const city of cities) {
    const key = allianceKey(city.aid);
    let group = groups.get(key);
    if (!group) {
      group = { ...metadata.get(key), aid: key === 'none' ? 0 : key, abbr: metadata.get(key)?.abbr || city.alliance_abbr, city_count: 0 };
      groups.set(key, group);
    }
    group.city_count++;
  }
  return [...groups.values()].sort((a, b) => b.city_count - a.city_count || String(a.aid).localeCompare(String(b.aid)));
}
export function filterStoredCities(cities: MapCity[], alliances: MapAlliance[], query: string, aid: string) {
  const tags = new Map(alliances.map(alliance => [allianceKey(alliance.aid), alliance.abbr ?? '']));
  const needle = query.trim().toLocaleLowerCase();
  return cities.filter(city => (!aid || allianceKey(city.aid) === aid)
    && (!needle || `${city.nick_name ?? ''} ${city.alliance_abbr ?? ''} ${tags.get(allianceKey(city.aid)) ?? ''}`.toLocaleLowerCase().includes(needle)));
}
export function savedTime(value: unknown, en: boolean): string | null {
  const ms = typeof value === 'number' ? value * 1000 : typeof value === 'string' && value.trim() ? Date.parse(value) : NaN;
  if (!Number.isFinite(ms) || ms < 0 || !Number.isFinite(new Date(ms).getTime())) return null;
  return new Date(ms).toLocaleString(en ? 'en-US' : 'ko-KR', { timeZone: 'Asia/Seoul' });
}

export default function StoredKingdomMap(props: Props) {
  // Changing the submitted kingdom synchronously removes the previous scope and aborts it.
  return <StoredMapScope key={props.kid} {...props} />;
}

export function StoredMapScope({ kid, initialFocus, selectedUID: profileUID, onLookup }: Props) {
  const { locale } = useLocale();
  const en = locale === 'en';
  const id = useId();
  const [snapshot, setSnapshot] = useState<StoredMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [issue, setIssue] = useState<StoredMapError | null>(null);
  const [retryUntil, setRetryUntil] = useState(0);
  const [query, setQuery] = useState('');
  const [aid, setAid] = useState('');
  const [selectedUID, setSelectedUID] = useState<string | null>(null);
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [manual, setManual] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const refreshLock = useRef(false);
  const [profileRefreshed, setProfileRefreshed] = useState(false);
  const request = useRef<AbortController | null>(null);
  const focusedProfile = useRef<string | null>(null);

  async function load(reload = false) {
    if (request.current || refreshLock.current || Date.now() < retryUntil) return;
    const controller = new AbortController(); request.current = controller;
    let timedOut = false;
    const timer = window.setTimeout(() => { timedOut = true; controller.abort(); }, 30000);
    setLoading(true); setIssue(null);
    try {
      const data = await fetchStoredMap(kid, controller.signal, reload);
      if (request.current !== controller || controller.signal.aborted) return;
      setSnapshot(data);
    } catch (cause) {
      if (request.current !== controller || (controller.signal.aborted && !timedOut)) return;
      const error = cause instanceof StoredMapError ? cause : new StoredMapError('failed');
      setIssue(error);
      if (error.issue === 'limited') setRetryUntil(Date.now() + Math.max(1, error.retryAfter) * 1000);
    } finally {
      window.clearTimeout(timer);
      if (request.current === controller) { request.current = null; setLoading(false); }
    }
  }
  useEffect(() => {
    void load();
    return () => { request.current?.abort(); request.current = null; };
  }, []);
  useEffect(() => {
    if (!retryUntil) return;
    const timer = window.setTimeout(() => setRetryUntil(0), Math.min(2_147_483_647, Math.max(0, retryUntil - Date.now())));
    return () => window.clearTimeout(timer);
  }, [retryUntil]);
  useEffect(() => {
    if (!snapshot) return;
    const target = JSON.stringify([profileUID, initialFocus?.x, initialFocus?.y, initialFocus?.scale]);
    if (focusedProfile.current === target) return;
    focusedProfile.current = target;
    setProfileRefreshed(false);
    if (!profileUID && !initialFocus) return;
    const city = snapshot.cities.find(city => String(city.uid) === profileUID);
    // Profile coordinates may have a different timestamp: never merge them into the map.
    setSelectedUID(city ? String(city.uid) : null);
    setFocus(city ? { x: city.x, y: city.y, scale: 20 } : initialFocus ?? null);
    setAid(''); setQuery('');
  }, [snapshot, profileUID, initialFocus?.x, initialFocus?.y, initialFocus?.scale]);

  const groups = useMemo(() => storedAllianceGroups(snapshot?.cities ?? [], snapshot?.alliances ?? []), [snapshot]);
  const activeAid = groups.some(group => allianceKey(group.aid) === aid) ? aid : '';
  const filtered = useMemo(() => filterStoredCities(snapshot?.cities ?? [], groups, query, activeAid), [snapshot, groups, query, activeAid]);
  const visibleGroups = useMemo(() => storedAllianceGroups(filtered, groups), [filtered, groups]);
  const selected = filtered.find(city => String(city.uid) === selectedUID) ?? null;
  const targetUID = profileUID ?? selectedUID;
  const targetCity = snapshot?.cities.find(city => String(city.uid) === targetUID);
  const allianceCount = groups.filter(group => allianceKey(group.aid) !== 'none').length;
  const count = (n: number) => n.toLocaleString(en ? 'en-US' : 'ko-KR');
  const label = (group: MapAlliance) => allianceKey(group.aid) === 'none' ? (en ? 'No alliance / unknown' : '연맹 없음 / 미상')
    : `${group.abbr ? `[${group.abbr}] ` : ''}${group.name || (en ? `Alliance ${group.aid}` : `연맹 ${group.aid}`)}`;
  const stamp = savedTime(snapshot?.updated_at, en);
  const collected = savedTime(snapshot?.coverage?.collected_at, en);
  const coverage = snapshot?.coverage;
  const hasCoverage = coverage && Number.isSafeInteger(coverage.located) && Number.isSafeInteger(coverage.total)
    && coverage.located >= 0 && coverage.total >= coverage.located;
  const issueText = issue?.issue === 'not_collected'
    ? (en ? 'Map coordinates are not available yet.' : '아직 지도 좌표를 불러올 수 없습니다.')
    : issue?.issue === 'storage'
      ? (en ? 'The map is unavailable. Please retry later.' : '지도를 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.')
      : issue?.issue === 'limited'
        ? (en ? 'Requests are temporarily limited. Please retry later.' : '요청이 일시적으로 제한되었습니다. 잠시 후 다시 시도해 주세요.')
        : (en ? 'Could not load the map. Please retry.' : '지도를 불러오지 못했습니다. 다시 시도해 주세요.');
  function selectAll() { setAid(''); setQuery(''); setSelectedUID(null); }
  function receiveSnapshot(data: MapSnapshot) {
    const next = parseMapSnapshot(data, kid);
    setSnapshot(next); setIssue(null); setProfileRefreshed(true);
    const uid = profileUID ?? selectedUID;
    if (uid) {
      const city = next.cities.find(city => String(city.uid) === uid);
      setAid(''); setQuery(''); setSelectedUID(city ? String(city.uid) : null);
      setFocus(city ? { x: city.x, y: city.y, scale: 20 } : null);
    }
  }

  return <section className="min-w-0 space-y-4" aria-label={en ? 'Kingdom map' : '왕국 지도'}>
    <div>
      <h3 className="font-bold">{en ? `Kingdom ${kid} · City map` : `왕국 ${kid} · 도시 지도`}</h3>
      <p className="mt-1 text-sm text-muted">{en ? 'Cities are shown from the saved map. Recent moves may not be reflected.' : '저장된 지도 기준으로 도시를 표시합니다. 최근 이동은 반영되지 않을 수 있습니다.'}</p>
    </div>
    <MapRefresh kid={kid} selectedUID={profileUID} baseline={locationTimestamp(snapshot)} disabled={loading || retryUntil > 0}
      onBusyChange={busy => {
        if (busy && (request.current || refreshLock.current || Date.now() < retryUntil)) return false;
        refreshLock.current = busy; setRefreshing(busy);
      }} onSnapshot={receiveSnapshot}>
      <button type="button" className={control} disabled={loading || refreshing || retryUntil > 0} onClick={() => void load(true)}>{en ? 'Reload map' : '지도 다시 불러오기'}</button>
      {snapshot && <span className="order-last basis-full text-xs text-muted" aria-live="polite" data-testid="map-location-summary">
        {targetUID && (targetCity
          ? `${targetCity.nick_name || `UID ${targetUID}`} · X: ${targetCity.x}, Y: ${targetCity.y} · `
          : (en ? `UID ${targetUID} was not found in this map. Current location is unknown. ` : `이 지도에서 UID ${targetUID}를 찾지 못했습니다. 현재 위치를 알 수 없습니다. `))}
        {snapshot.source === 'mightpulse' ? (en ? 'Map positions updated at: ' : '지도 위치 갱신 시각: ') : (en ? 'Saved at: ' : '저장 시각: ')}{stamp ?? (en ? 'unknown' : '정보 없음')} (KST)
      </span>}
    </MapRefresh>
    {loading && <p role="status" className="text-sm text-muted">{en ? 'Loading map…' : '지도를 불러오는 중…'}{snapshot && (en ? ' The previous map remains visible.' : ' 기존 지도를 계속 표시합니다.')}</p>}
    {issue && <div role="status" className="space-y-1 text-sm text-danger">
      <p>{issueText}</p>
      <p>{snapshot ? (en ? 'Keeping the previously loaded map; this attempt did not update it.' : '이전에 불러온 지도를 유지합니다. 이번 요청으로 지도는 갱신되지 않았습니다.') : (en ? 'This does not mean the kingdom has no cities.' : '왕국에 도시가 없다는 뜻은 아닙니다.')}</p>
    </div>}
    {snapshot && <>
      <div className="space-y-1" aria-live="polite">
        <p className="font-bold">{en ? `${count(snapshot.cities.length)} cities · ${count(allianceCount)} alliances` : `도시 ${count(snapshot.cities.length)}개 · 연맹 ${count(allianceCount)}개`}</p>
        {snapshot.stale && <p role="status" className="text-sm text-danger">{en ? 'Saved map fallback · The source map could not be loaded. Showing previously saved coordinates.' : '저장된 지도 대체 표시 · 원본 지도를 불러오지 못해 이전에 저장된 좌표를 표시합니다.'}</p>}
        {snapshot.partial && <p role="status" className="text-sm text-danger">{en ? 'Partial map · Only available coordinates are shown; some cities may be missing.' : '일부 좌표만 표시 · 확보된 좌표만 표시하므로 일부 도시가 누락될 수 있습니다.'}</p>}
        <p className="text-xs text-muted">{snapshot.source === 'mightpulse'
          ? (en ? `Map positions updated at: ${stamp ?? 'unknown'} (KST). Current positions may differ.` : `지도 위치 갱신 시각: ${stamp ?? '정보 없음'} (한국 시간). 현재 위치와 다를 수 있습니다.`)
          : (en ? `Saved at: ${stamp ?? 'unknown'} (KST). This is not the time of a city’s position.` : `저장 시각: ${stamp ?? '정보 없음'} (한국 시간). 도시 위치가 확인된 시각을 뜻하지 않습니다.`)}</p>
        {collected && <p className="text-xs text-muted">{en ? `Collection record saved at: ${collected} (KST)` : `수집 기록 저장 시각: ${collected} (한국 시간)`}</p>}
        {hasCoverage && <p className="text-xs text-muted">{en ? `Collection record: ${count(coverage.located)} located / ${count(coverage.total)} known roster entries; not a kingdom-wide total.` : `수집 기록: 확인된 명단 ${count(coverage.total)}명 중 좌표 ${count(coverage.located)}명 · 왕국 전체 인원 아님`}</p>}
      </div>
      {!profileRefreshed && initialFocus && (!profileUID || !snapshot.cities.some(city => String(city.uid) === profileUID)) && <p className="text-xs text-muted">{en ? 'This profile could not be matched to a city on the map. Centered on profile coordinates only; their timestamp may differ from the map.' : '이 프로필과 일치하는 도시를 지도에서 찾지 못했습니다. 프로필 좌표는 화면 중심으로만 사용하며 지도와 확인 시각이 다를 수 있습니다.'}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <label htmlFor={`${id}-query`} className="text-sm font-bold">{en ? 'Nickname or alliance tag' : '닉네임 / 연맹 태그 검색'}
          <input id={`${id}-query`} type="search" className={field} value={query} onChange={e => { setQuery(e.target.value); setSelectedUID(null); }} placeholder={en ? 'Search cities' : '도시 검색'} />
        </label>
        <label htmlFor={`${id}-alliance`} className="text-sm font-bold">{en ? 'Alliance' : '연맹'}
          <select id={`${id}-alliance`} className={field} value={activeAid} onChange={e => { setAid(e.target.value); setSelectedUID(null); }}>
            <option value="">{en ? 'All alliances' : '전체 연맹'}</option>
            {groups.map(group => <option key={group.aid} value={allianceKey(group.aid)}>{label(group)} · {count(group.city_count)}</option>)}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={control} onClick={selectAll}>{en ? 'Select all' : '전체 선택'}</button>
        <p role="status" className="text-sm text-muted">{en ? `${count(filtered.length)} of ${count(snapshot.cities.length)} cities match the filters` : `도시 ${count(snapshot.cities.length)}개 중 필터에 맞는 ${count(filtered.length)}개 표시`}</p>
      </div>
      <ul aria-label={en ? 'Alliance colors and filtered city counts' : '연맹 색상과 필터된 도시 수'} className="flex max-h-40 flex-wrap gap-x-4 gap-y-2 overflow-y-auto text-xs">
        {visibleGroups.map(group => <li key={group.aid} className="flex min-w-0 items-center gap-2"><span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full" style={{ background: allianceColor(group.aid) }} /><span className="break-words">{label(group)} · {count(group.city_count)}</span></li>)}
      </ul>
      {!filtered.length && <p className="text-sm text-muted">{snapshot.cities.length ? (en ? 'No cities match these filters. Select all to restore the cities.' : '필터에 맞는 도시가 없습니다. 전체 선택으로 도시를 다시 표시할 수 있습니다.') : (en ? 'This map contains no coordinates. It does not establish that the kingdom is empty.' : '이 지도에 표시할 좌표가 없습니다. 왕국에 도시가 없다는 뜻은 아닙니다.')}</p>}
      <KingdomMapCanvas cities={filtered} allCities={snapshot.cities} alliances={groups} bounds={snapshot.bounds}
        fitAllCities preserveCameraOnUpdate focus={focus} selected={selected}
        onSelect={city => setSelectedUID(String(city.uid))} onClose={() => setSelectedUID(null)} onLookup={city => onLookup(String(city.uid))} />
      <details className="rounded-lg border border-border p-3">
        <summary className="cursor-pointer text-sm font-bold">{en ? 'City list' : '도시 목록'} ({count(filtered.length)})</summary>
        <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">
          {filtered.map(city => <li key={city.uid}><button type="button" className="w-full break-words rounded border border-border px-3 py-2 text-left text-sm" aria-pressed={String(city.uid) === selectedUID} onClick={() => { setSelectedUID(String(city.uid)); setFocus({ x: city.x, y: city.y, scale: 20 }); }}>
            {city.alliance_abbr ? `[${city.alliance_abbr}] ` : ''}{city.nick_name || (en ? 'Unknown name' : '이름 정보 없음')} · X: {city.x}, Y: {city.y}
          </button></li>)}
        </ul>
      </details>
    </>}
    <details className="rounded-lg border border-border p-3" onToggle={event => setManual(event.currentTarget.open)}>
      <summary className="cursor-pointer text-sm font-bold">{en ? 'Manual single-alliance profile lookup' : '단일 연맹 프로필 수동 조회'}</summary>
      {manual && <div className="mt-4"><OfficialAllianceMap kid={kid} onLookup={onLookup} /></div>}
    </details>
  </section>;
}
