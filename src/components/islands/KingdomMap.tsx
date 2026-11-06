import { useEffect, useId, useState, type SubmitEvent } from 'react';
import { useLocale } from '../../lib/locale';
import type { PlayerIdType } from './PlayerDiscovery';
import type { MapPlayerPreview } from '../../lib/player-preview';
import StoredKingdomMap from './StoredKingdomMap';

interface Props { playerKingdom?: string; onSelect: (value: string, type: PlayerIdType, preview?: MapPlayerPreview) => void }

export default function KingdomMap({ playerKingdom, onSelect }: Props) {
  const { locale } = useLocale();
  const en = locale === 'en';
  const id = useId();
  const [kingdom, setKingdom] = useState(playerKingdom ?? '');
  const [kid, setKid] = useState<number | null>(null);
  const [invalid, setInvalid] = useState(false);
  useEffect(() => { if (playerKingdom) setKingdom(playerKingdom); }, [playerKingdom]);
  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = kingdom.trim();
    if (!/^\d{1,5}$/.test(value) || Number(value) < 1 || Number(value) > 10000) {
      setInvalid(true); return;
    }
    setInvalid(false); setKid(Number(value));
  }
  return <div className="space-y-4">
    <form onSubmit={submit} noValidate>
      <label htmlFor={id} className="block font-bold">{locale === 'zh-TW' ? "王國編號" : en ? 'Kingdom number' : '왕국 번호'}</label>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        <input id={id} className="min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 py-3" value={kingdom} onChange={e => setKingdom(e.target.value)} inputMode="numeric" maxLength={5} placeholder={locale === 'zh-TW' ? "例如：1622" : en ? 'e.g. 1622' : '예: 1622'} aria-invalid={invalid} aria-describedby={invalid ? `${id}-error` : undefined} />
        <button className="rounded-lg bg-accent px-5 py-3 font-bold text-on-accent">{locale === 'zh-TW' ? "查詢王國地圖" : en ? 'Load kingdom map' : '왕국 지도 조회'}</button>
      </div>
    </form>
    {invalid && <p id={`${id}-error`} role="alert" className="text-sm text-danger">{locale === 'zh-TW' ? "請輸入 1～10000 的王國編號。" : en ? 'Enter a kingdom number from 1 to 10000.' : '왕국 번호는 1~10000 사이의 숫자로 입력해 주세요.'}</p>}
    {kid === null ? <p className="text-sm text-muted">{locale === 'zh-TW' ? "輸入王國編號，即可查看地圖中所有聯盟的城鎮。" : en ? 'Enter a kingdom to view its available city map across all alliances.' : '왕국 번호를 조회하면 지도에서 확인되는 모든 연맹의 도시를 함께 표시합니다.'}</p> : <StoredKingdomMap kid={kid} onLookup={(uid, preview) => onSelect(uid, 'uid', preview)} />}
  </div>;
}
