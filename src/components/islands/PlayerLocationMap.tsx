import { useEffect, useId, useMemo, useState } from 'react';
import KingdomMapCanvas, { type MapAlliance, type MapCity, type MapFocus } from './KingdomMapCanvas';

type Scalar = string | number | null | undefined;
interface Props { kid: Scalar; x: Scalar; y: Scalar; uid: Scalar; onLookup: (uid: string) => void }
interface Snapshot { cities: MapCity[]; alliances: MapAlliance[]; updated_at?: number | null }
const number = (value: Scalar) => value == null || String(value).trim() === '' ? NaN : Number(value);
const coordinate = (value: number) => Number.isFinite(value) && value >= 0 && value <= 1200;
const bounds = { min: 0, max: 1200 };
const control = 'rounded-lg border border-border bg-raised px-3 py-2 text-sm font-semibold hover:border-accent focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40';

export default function PlayerLocationMap(props: Props) {
  const regionId = useId();
  const [open, setOpen] = useState(true);
  const kid = number(props.kid), x = number(props.x), y = number(props.y);
  const validKingdom = Number.isInteger(kid) && kid >= 1 && kid <= 10000;
  const validCoordinates = coordinate(x) && coordinate(y);
  const reason = !validKingdom ? '왕국 번호가 없어 지도를 표시할 수 없습니다. (유효 범위: 1~10000)' : !validCoordinates ? '좌표가 없거나 유효 범위(0~1200)를 벗어났습니다.' : '';
  return <div className="mt-5 min-w-0">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs text-muted">좌표</p><p className="mt-1 font-semibold">{validCoordinates ? `X: ${x} · Y: ${y}` : '—'}</p></div>
      <button type="button" className={control} disabled={!!reason} aria-expanded={open} aria-controls={regionId} aria-describedby={reason ? `${regionId}-help` : undefined} onClick={() => setOpen(!open)}>{open ? '위치 지도 닫기' : '지도에서 위치 보기'}</button>
    </div>
    {reason && <p id={`${regionId}-help`} className="mt-2 text-xs text-muted">{reason}</p>}
    <div id={regionId} hidden={!open} role="region" aria-label="영주 위치 지도">
      {open && !reason && <LocationSnapshot kid={kid} x={x} y={y} uid={props.uid} onLookup={props.onLookup} />}
    </div>
  </div>;
}

function LocationSnapshot({ kid, x, y, uid, onLookup }: { kid: number; x: number; y: number; uid: Scalar; onLookup: Props['onLookup'] }) {
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<MapCity | null>(null);
  const [focus, setFocus] = useState<MapFocus>({ x, y, scale: 20 });
  const initialFocus = useMemo(() => ({ x, y, scale: 20 }), [x, y]);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timer = window.setTimeout(() => {
      controller.abort();
      if (active) setError('지도 조회 시간이 초과되었습니다. 닫은 뒤 다시 열어 주세요.');
    }, 40_000);
    void (async () => {
      try {
        const response = await fetch(`/api/map/?kid=${kid}`, { signal: controller.signal, headers: { Accept: 'application/json' } });
        const result = await response.json();
        if (!active || controller.signal.aborted) return;
        if (!response.ok || !result?.ok || Number(result.kid) !== kid || !Array.isArray(result.cities) || !Array.isArray(result.alliances)) throw new Error('Invalid map');
        const cities: MapCity[] = result.cities.filter((city: MapCity) => city && coordinate(city.x) && coordinate(city.y));
        setData({ cities, alliances: result.alliances, updated_at: result.updated_at });
        // Never substitute nickname, nearby coordinates, or governor ID for the UID.
        setSelected(uid == null || String(uid).trim() === '' ? null : cities.find(city => String(city.uid) === String(uid)) ?? null);
      } catch {
        if (active && !controller.signal.aborted) setError('지도를 불러오지 못했습니다. 닫은 뒤 다시 열어 주세요.');
      } finally { window.clearTimeout(timer); }
    })();
    return () => { active = false; controller.abort(); window.clearTimeout(timer); };
  }, [kid, uid]);
  const target = data?.cities.find(city => uid != null && String(city.uid) === String(uid));
  const updated = data?.updated_at == null ? null : new Date(data.updated_at * 1000);
  const validTime = updated && !Number.isNaN(updated.getTime());
  return <div className="mt-4 min-w-0 space-y-3 rounded-xl border border-border bg-bg p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm font-bold">왕국 {kid} · 프로필 위치</p>
      {data && <button type="button" className={control} onClick={() => { setFocus({ ...initialFocus }); setSelected(target ?? null); }}>프로필 좌표로</button>}
    </div>
    {!data && !error && <p role="status" className="text-sm text-muted">저장된 지도를 불러오는 중…</p>}
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    {data && <>
      <p className="text-xs text-muted">저장된 지도 · 실시간 아님 · {validTime ? <time dateTime={updated.toISOString()}>{updated.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} KST</time> : '갱신 시각 미상'}</p>
      {!target ? <p className="text-xs text-muted">{data.cities.length ? '일치하는 UID의 도시가 없어' : '저장된 도시가 없어'} 프로필 좌표만 중심에 표시합니다.</p> : (target.x !== x || target.y !== y) && <p className="text-xs text-muted">저장된 도시 위치(X: {target.x} · Y: {target.y})가 다릅니다. 중심은 프로필 좌표, 선택 도시는 저장된 위치를 따릅니다.</p>}
      <div className="min-w-0 [&>div:not(.fixed)>div.relative]:h-[360px]">
        <KingdomMapCanvas cities={data.cities} allCities={data.cities} alliances={data.alliances} bounds={bounds} initialFocus={initialFocus} focus={focus} selected={selected} onSelect={setSelected} onClose={() => setSelected(null)} onLookup={city => onLookup(String(city.uid))} />
      </div>
      <details className="text-sm"><summary className="cursor-pointer rounded py-2 focus-visible:outline-2 focus-visible:outline-accent">주변 도시 · 키보드로 선택</summary>
        <ul className="max-h-40 space-y-1 overflow-y-auto">{data.cities.filter(city => Math.abs(city.x - x) <= 20 && Math.abs(city.y - y) <= 20).map(city => <li key={city.uid}><button type="button" className="w-full rounded px-2 py-2 text-left hover:bg-raised focus-visible:outline-2 focus-visible:outline-accent" onClick={() => { setSelected(city); setFocus({ x: city.x, y: city.y, scale: 20 }); }}>{city.nick_name || '이름 정보 없음'} · {city.x}, {city.y}</button></li>)}</ul>
      </details>
    </>}
  </div>;
}
