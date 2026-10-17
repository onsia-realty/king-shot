import { useLocale } from '../../lib/locale';
import { RateLimitError } from '../../lib/api-response';
import { playerText, playerNumberLocale, playerError } from '../../lib/player-localization';
import { useEffect, useId, useMemo, useState } from 'react';
import KingdomMapCanvas, { type MapCity, type MapFocus } from './KingdomMapCanvas';
import MapRefresh from './MapRefresh';
import { loadMapSnapshot, selectedCity, type MapSnapshot } from '../../lib/map-refresh';

type Scalar = string | number | null | undefined;
interface Props { kid: Scalar; x: Scalar; y: Scalar; uid: Scalar; onLookup: (uid: string) => void }
const number = (value: Scalar) => value == null || String(value).trim() === '' ? NaN : Number(value);
const coordinate = (value: number) => Number.isFinite(value) && value >= 0 && value <= 1200;
const control = 'rounded-lg border border-border bg-raised px-3 py-2 text-sm font-semibold hover:border-accent focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40';

export default function PlayerLocationMap(props: Props) {
  const { locale } = useLocale();
  const tr = (text: string) => playerText(text, locale);
  const regionId = useId();
  const [open, setOpen] = useState(true);
  const [location, setLocation] = useState<MapCity | null | undefined>(undefined);
  const kid = number(props.kid), x = number(props.x), y = number(props.y);
  const validKingdom = Number.isInteger(kid) && kid >= 1 && kid <= 10000;
  const validCoordinates = coordinate(x) && coordinate(y);
  const reason = !validKingdom ? tr("왕국 번호가 없어 지도를 표시할 수 없습니다. (유효 범위: 1~10000)") : !validCoordinates ? tr("좌표가 없거나 유효 범위(0~1200)를 벗어났습니다.") : '';
  return <div className="mt-5 min-w-0">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs text-muted">{location === undefined ? (locale === 'en' ? 'Profile coordinates (before map lookup)' : '프로필 좌표 (지도 조회 전)') : (locale === 'en' ? 'Saved map coordinates' : '저장 지도 좌표')}</p><p data-testid="profile-map-coordinates" className="mt-1 font-semibold">{location ? `X: ${location.x} · Y: ${location.y}` : location === undefined && validCoordinates ? `X: ${x} · Y: ${y}` : '—'}</p></div>
      <button type="button" className={control} disabled={!!reason} aria-expanded={open} aria-controls={regionId} aria-describedby={reason ? `${regionId}-help` : undefined} onClick={() => setOpen(!open)}>{open ? tr("위치 지도 닫기") : tr("지도에서 위치 보기")}</button>
    </div>
    {reason && <p id={`${regionId}-help`} className="mt-2 text-xs text-muted">{reason}</p>}
    <div id={regionId} hidden={!open} role="region" aria-label={tr("영주 위치 지도")}>
      {open && !reason && <LocationSnapshot kid={kid} x={x} y={y} uid={props.uid} onLookup={props.onLookup} onLocation={setLocation} />}
    </div>
  </div>;
}

function LocationSnapshot({ kid, x, y, uid, onLookup, onLocation }: { kid: number; x: number; y: number; uid: Scalar; onLookup: Props['onLookup']; onLocation: (city: MapCity | null) => void }) {
  const { locale } = useLocale();
  const tr = (text: string) => playerText(text, locale);
  const [data, setData] = useState<MapSnapshot | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<MapCity | null>(null);
  const [focus, setFocus] = useState<MapFocus>({ x, y, scale: 20 });
  const target = data ? selectedCity(data.cities, uid) : null;
  const initialFocus = useMemo(() => target ? ({ x: target.x, y: target.y, scale: 20 }) : data ? ({ x: 600, y: 600, scale: 0.5 }) : ({ x, y, scale: 20 }), [target, data, x, y]);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timer = window.setTimeout(() => {
      controller.abort();
      if (active) setError('지도 조회 시간이 초과되었습니다. 닫은 뒤 다시 열어 주세요.');
    }, 40_000);
    void (async () => {
      try {
        const result = await loadMapSnapshot(kid, controller.signal);
        if (!active || controller.signal.aborted) return;
        const cities: MapCity[] = result.cities.filter((city: MapCity) => city && coordinate(city.x) && coordinate(city.y));
        setData({ ...result, cities });
        // Never substitute nickname, nearby coordinates, or governor ID for the UID.
        const next = selectedCity(cities, uid);
        setSelected(next); onLocation(next);
        setFocus(next ? { x: next.x, y: next.y, scale: 20 } : { x: 600, y: 600, scale: 0.5 });
      } catch (error) {
        if (active && !controller.signal.aborted) setError(error instanceof RateLimitError ? error.message : '지도를 불러오지 못했습니다. 닫은 뒤 다시 열어 주세요.');
      } finally { window.clearTimeout(timer); }
    })();
    return () => { active = false; controller.abort(); window.clearTimeout(timer); };
  }, [kid, uid, onLocation]);
  const updated = data?.updated_at == null ? null : new Date(data.updated_at * 1000);
  const validTime = updated && !Number.isNaN(updated.getTime());
  return <div className="mt-4 min-w-0 space-y-3 rounded-xl border border-border bg-bg p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm font-bold">{tr("왕국 ")}{kid}{tr(" · 프로필 위치")}</p>
      {data && <button type="button" className={control} disabled={!target} onClick={() => { setFocus({ ...initialFocus }); setSelected(target); }}>{locale === 'en' ? 'To saved player location' : '저장된 영주 위치로'}</button>}
    </div>
    {!data && !error && <p role="status" className="text-sm text-muted">{tr("저장된 지도를 불러오는 중…")}</p>}
    {error && <p role="alert" className="text-sm text-danger">{playerError(error, locale)}</p>}
    {data && <>
      <MapRefresh key={kid} kid={kid} baseline={data.updated_at} onSnapshot={snapshot => {
        const nextTarget = selectedCity(snapshot.cities, uid);
        const nextSelected = selectedCity(snapshot.cities, selected?.uid);
        setData(snapshot); setSelected(nextSelected); onLocation(nextTarget);
        const next = nextSelected ?? nextTarget;
        setFocus(next ? { x: next.x, y: next.y, scale: 20 } : { x: 600, y: 600, scale: 0.5 });
      }} />
      <p className="text-xs text-muted">{tr("저장된 지도 · 실시간 아님 · ")}{validTime ? <time dateTime={updated.toISOString()}>{updated.toLocaleString(playerNumberLocale(), { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} KST</time> : tr("갱신 시각 미상")}</p>
      {!target && <p className="text-xs text-muted">{locale === 'en' ? 'This UID is absent from the latest saved map. Its current location is unknown.' : '최신 저장 지도에 이 UID가 없습니다. 현재 위치를 알 수 없습니다.'}</p>}
      <div className="min-w-0 [&>div:not(.fixed)>div.relative]:h-[360px]">
        <KingdomMapCanvas cities={data.cities} allCities={data.cities} alliances={data.alliances} bounds={data.bounds} initialFocus={initialFocus} focus={focus} selected={selected} onSelect={setSelected} onClose={() => setSelected(null)} onLookup={city => onLookup(String(city.uid))} />
      </div>
      <details className="text-sm"><summary className="cursor-pointer rounded py-2 focus-visible:outline-2 focus-visible:outline-accent">{tr("주변 도시 · 키보드로 선택")}</summary>
        <ul className="max-h-40 space-y-1 overflow-y-auto">{data.cities.filter(city => target && Math.abs(city.x - target.x) <= 20 && Math.abs(city.y - target.y) <= 20).map(city => <li key={city.uid}><button type="button" className="w-full rounded px-2 py-2 text-left hover:bg-raised focus-visible:outline-2 focus-visible:outline-accent" onClick={() => { setSelected(city); setFocus({ x: city.x, y: city.y, scale: 20 }); }}>{city.nick_name || tr("이름 정보 없음")} · {city.x}, {city.y}</button></li>)}</ul>
      </details>
    </>}
  </div>;
}
