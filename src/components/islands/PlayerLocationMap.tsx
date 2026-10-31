import { useId, useMemo, useState } from 'react';
import { useLocale } from '../../lib/locale';
import StoredKingdomMap from './StoredKingdomMap';

type Scalar = string | number | null | undefined;
interface Props {
  kid: Scalar; x: Scalar; y: Scalar; uid: Scalar;
  name?: string; townLevel?: Scalar; power?: Scalar; tag?: string; aid?: Scalar;
  profileCachedAt?: Scalar; onLookup: (uid: string) => void;
}
const number = (value: Scalar) => value == null || String(value).trim() === '' ? NaN : Number(value);
const coordinate = (value: number) => Number.isFinite(value) && value >= 0 && value <= 1200;

export default function PlayerLocationMap(props: Props) {
  const { locale } = useLocale();
  const en = locale === 'en';
  const regionId = useId();
  const [open, setOpen] = useState(true);
  const kid = number(props.kid), x = number(props.x), y = number(props.y);
  const uid = String(props.uid ?? '').trim();
  const validKingdom = Number.isInteger(kid) && kid >= 1 && kid <= 10000;
  const validCoordinates = coordinate(x) && coordinate(y);
  const validUID = /^\d{1,15}$/.test(uid) && /[1-9]/.test(uid);
  // Coordinates are a camera fallback only. The map's own city data stays intact.
  const initialFocus = useMemo(() => validCoordinates ? { x, y, scale: 20 } : undefined, [x, y, validCoordinates]);
  return <div className="mt-5 min-w-0 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs text-muted">{en ? 'Saved profile coordinates · may differ from the map below' : '저장된 프로필 좌표 · 아래 지도 위치와 다를 수 있습니다'}</p><p data-testid="profile-map-coordinates" className="mt-1 font-semibold">{validCoordinates ? `X: ${x} · Y: ${y}` : '—'}</p></div>
      <button type="button" className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-40" disabled={!validKingdom} aria-expanded={open} aria-controls={regionId} onClick={() => setOpen(!open)}>{open ? (en ? 'Close location map' : '위치 지도 닫기') : (en ? 'Show location map' : '지도에서 위치 보기')}</button>
    </div>
    {(!validKingdom || !validCoordinates || !validUID) && <p className="text-xs text-muted">{!validKingdom ? (en ? 'A valid kingdom number (1–10000) is unavailable.' : '유효한 왕국 번호(1~10000)가 없어 지도를 표시할 수 없습니다.') : !validCoordinates ? (en ? 'Profile coordinates are unavailable or outside 0–1200. The kingdom map is still available.' : '프로필 좌표가 없거나 유효 범위(0~1200)를 벗어났습니다. 왕국 지도는 조회할 수 있습니다.') : (en ? 'The actual player UID is unavailable, so a city cannot be selected for this profile. The kingdom map is still available.' : '실제 영주 UID가 없어 이 프로필의 도시를 선택할 수 없습니다. 왕국 지도는 조회할 수 있습니다.')}</p>}
    <div id={regionId} hidden={!open} role="region" aria-label={en ? 'Player location map' : '영주 위치 지도'}>
      {open && validKingdom && <StoredKingdomMap kid={kid} initialFocus={initialFocus} selectedUID={validUID ? uid : undefined} onLookup={props.onLookup} />}
    </div>
  </div>;
}
