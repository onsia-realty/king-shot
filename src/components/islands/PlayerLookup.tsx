import { useLocale } from '../../lib/locale';
import { readApiJson, RateLimitError } from '../../lib/api-response';
import { playerText, playerText as tr, playerNumberLocale, playerError, playerLabel, playerStatValue } from '../../lib/player-localization';
import { useEffect, useRef, useState, type SubmitEvent, type ReactNode } from 'react';

import ArenaHeroes, { type ArenaHero, type HeroCatalog } from './ArenaHeroes';
import PlayerDiscovery, { type PlayerIdType } from './PlayerDiscovery';
import KingdomMap from './KingdomMap';
import PlayerLocationMap from './PlayerLocationMap';
export type { HeroCatalog } from './ArenaHeroes';
type Scalar = string | number | null;
interface GovernorGear {
  slot?: Scalar; name?: string; quality?: Scalar; tier?: Scalar; star?: Scalar;
  strength_level?: Scalar; score?: Scalar; combat?: Scalar; icon?: string;
  gems?: { slot?: Scalar; id?: Scalar }[];
}
interface LookupResult {
  ok: boolean; governor_id?: Scalar; uid?: Scalar; message?: string;
  player?: {
    nick_name?: string; kid?: Scalar; power?: Scalar; town_center_level?: Scalar;
    vip?: Scalar; x?: Scalar; y?: Scalar; kills?: Scalar; avatar_url?: string;
    alliance?: { aid?: Scalar; abbr?: string; name?: string; rank?: Scalar; rank_label?: string;
      power?: Scalar; count?: Scalar; flag_url?: string; leader_name?: string } | null;
  } | null;
  heroes?: ArenaHero[] | null; ranks?: Record<string, Scalar> | null;
  gov_gear?: { hidden?: boolean; message?: string; items?: GovernorGear[] | null } | null;
  fresh?: boolean; cached_at?: Scalar; age_seconds?: Scalar;
}

const panel = 'min-w-0 rounded-2xl border border-border bg-surface p-4 sm:p-6';
const slots: Record<string, string> = { helmet: '머리', gloves: '장갑', armor: '갑옷', boots: '신발' };
const grades: Record<string, string> = { common: '일반', uncommon: '고급', rare: '레어', epic: '에픽', legendary: '전설', mythic: '신화', mythic_red: '신화' };
const rankLabels = [
  ['power_rank', 'power', '전투력'],
  ['kills_rank', 'kills', '처치 수'],
  ['town_center_rank', 'town_center_level', '도시 센터'],
  ['migrant_rank', 'migrant_score', '이민 점수'],
  ['mystic_rank', 'mystic_trial', '신비의 시련'],
] as const;
const hasValue = (v: unknown) => v !== null && v !== undefined && v !== '';
const numeric = (v: unknown): number | undefined => {
  if (!hasValue(v) || (typeof v !== 'number' && typeof v !== 'string')) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};
const format = (v: unknown) => {
  const n = numeric(v);
  return n === undefined ? (typeof v === 'string' ? playerStatValue(v) : '—') : n.toLocaleString(playerNumberLocale());
};
function imageUrl(path?: string) {
  if (!path) return undefined;
  try {
    const url = new URL(path, 'https://mightpulse.com');
    return url.protocol === 'https:' ? url.href : undefined;
  } catch { return undefined; }
}
function townLevel(v: unknown) {
  const n = numeric(v);
  if (n === undefined) return '—';
  // MightPulse levelLabel: TG1 begins at 35, with five steps per tier (maximum TG8).
  return n >= 35 ? `${tr("순금 ")}${Math.min(8, Math.floor((n - 35) / 5) + 1)}` : `${tr("도시 레벨 ")}${format(n)}`;
}
function cachedTime(v: unknown) {
  if (!hasValue(v)) return undefined;
  const n = numeric(v);
  const date = new Date(n === undefined ? String(v) : n * 1000);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
function Stat({ label, children }: { label: string; children: ReactNode }) {
  return <div className="min-w-0"><dt className="text-xs text-muted">{label}</dt><dd className="mt-1 break-words font-semibold [overflow-wrap:anywhere]">{children}</dd></div>;
}
function Picture({ src, label, local = false }: { src?: string; label: string; local?: boolean }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const url = local ? src : imageUrl(src);
  return <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-raised text-xl text-accent">
    {url && !failed ? <img src={url} alt={label} width={64} height={64} loading="lazy" onError={() => setFailed(true)} className="size-full object-cover" /> : <span aria-hidden="true">{label.slice(0, 1)}</span>}
  </div>;
}

export default function PlayerLookup({ heroes: catalog }: { heroes: HeroCatalog }) {
  const { locale } = useLocale();
  const tr = (text: string) => playerText(text, locale);
  const [id, setId] = useState('');
  const [tab, setTab] = useState<'search' | 'map' | 'id'>('search');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<LookupResult | null>(null);
  const [queriedId, setQueriedId] = useState('');
  const request = useRef<AbortController | null>(null);
  const started = useRef(false);
  const profile = useRef<HTMLDivElement | null>(null);
  const scrollToProfile = useRef(false);

  async function lookup(value: string, idType: PlayerIdType = 'governor_id', revealProfile = false) {
    scrollToProfile.current = revealProfile;
    request.current?.abort();
    request.current = null;
    setLoading(false);
    const fid = value.trim();
    if (!/^\d{1,15}$/.test(fid) || !/[1-9]/.test(fid)) {
      setError('조회 ID는 1~15자리의 0보다 큰 숫자로 입력해 주세요.');
      setResult(null);
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    let timedOut = false;
    const timer = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 105_000);
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const response = await fetch(`/api/player/?id=${encodeURIComponent(fid)}${idType === 'uid' ? '&id_type=uid' : ''}`, { signal: controller.signal, headers: { Accept: 'application/json' } });
      const data: LookupResult = await readApiJson(response);
      if (controller.signal.aborted || request.current !== controller) return;
      if (!response.ok || !data.ok) {
        setError(data.message || '영주 정보를 불러오지 못했습니다. ID를 확인하고 다시 조회해 주세요.');
        return;
      }
      if (!data.player) {
        setError('조회된 영주 정보가 없습니다. 다른 ID로 다시 조회해 주세요.');
        return;
      }
      const governorId = String(data.governor_id ?? '');
      const validGovernorId = /^\d{1,15}$/.test(governorId) && /[1-9]/.test(governorId);
      setQueriedId(validGovernorId ? governorId.replace(/^0+/, '') : '');
      setId(validGovernorId ? governorId : '');
      setResult(data);
      const url = new URL(window.location.href);
      if (validGovernorId) url.searchParams.set('id', governorId);
      else url.searchParams.delete('id');
      url.searchParams.delete('id_type');
      window.history.replaceState(null, '', url);
    } catch (error) {
      if (request.current === controller && (!controller.signal.aborted || timedOut)) {
        setError(error instanceof RateLimitError ? error.message : timedOut ? '조회 시간이 초과되었습니다. 잠시 후 다시 조회해 주세요.' : '조회 연결에 문제가 생겼습니다. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      window.clearTimeout(timer);
      if (request.current === controller) {
        request.current = null;
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    // Shared links prefill the form; a blank visit never sends a lookup request.
    if (!started.current) {
      started.current = true;
      const initialId = new URLSearchParams(window.location.search).get('id') ?? '';
      setId(initialId);
      if (initialId) setTab('id');
    }
    return () => { request.current?.abort(); request.current = null; };
  }, []);

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    void lookup(id);
  }

  const player = result?.player;
  useEffect(() => {
    if (!result || !scrollToProfile.current || !profile.current) return;
    scrollToProfile.current = false;
    profile.current.scrollIntoView({ behavior: 'instant', block: 'start' });
  }, [result]);
  const alliance = player?.alliance;
  const updated = cachedTime(result?.cached_at);
  const age = numeric(result?.age_seconds);

  return <div className="space-y-6">
    <section className={panel} aria-label={tr("영주 찾기")}>
      <div role="tablist" aria-label={tr("영주 찾는 방법")} className="mb-5 grid grid-cols-3 gap-2">
        {([['search', tr("닉네임 검색")], ['map', tr("왕국 지도")], ['id', tr("영주 ID")]] as const).map(([key, label], index, tabs) => <button key={key} type="button" id={`lookup-tab-${key}`} role="tab" aria-selected={tab === key} aria-controls={`lookup-panel-${key}`} tabIndex={tab === key ? 0 : -1} onClick={() => setTab(key)} onKeyDown={(event) => {
          const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
          const target = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : offset ? (index + offset + tabs.length) % tabs.length : -1;
          if (target < 0) return;
          event.preventDefault();
          const nextTab = tabs[target][0];
          setTab(nextTab);
          document.getElementById(`lookup-tab-${nextTab}`)?.focus();
        }} className={`min-w-0 rounded-lg border px-2 py-3 text-sm font-bold ${tab === key ? 'border-accent bg-accent text-on-accent' : 'border-border bg-bg text-muted hover:text-text'}`}>{label}</button>)}
      </div>
      <div id="lookup-panel-search" role="tabpanel" aria-labelledby="lookup-tab-search" hidden={tab !== 'search'}><PlayerDiscovery onSelect={(value, type) => { void lookup(value, type); }} /></div>
      <div id="lookup-panel-map" role="tabpanel" aria-labelledby="lookup-tab-map" hidden={tab !== 'map'}><KingdomMap playerKingdom={hasValue(player?.kid) ? String(player?.kid) : undefined} playerLocation={numeric(player?.x) !== undefined && numeric(player?.y) !== undefined ? { x: numeric(player?.x)!, y: numeric(player?.y)! } : undefined} playerAid={hasValue(player?.alliance?.aid) ? String(player?.alliance?.aid) : undefined} onSelect={(value, type) => { void lookup(value, type, true); }} /></div>
      <div id="lookup-panel-id" role="tabpanel" aria-labelledby="lookup-tab-id" hidden={tab !== 'id'}>
    <form onSubmit={submit} aria-busy={loading} noValidate>
      <label htmlFor="governor-id" className="block font-bold">{tr("영주 ID (게임 프로필의 ID)")}</label>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <input id="governor-id" name="id" value={id} onChange={(e) => setId(e.target.value)} inputMode="numeric" autoComplete="off" maxLength={15} disabled={loading} aria-describedby={`lookup-help${error ? ' lookup-error' : ''}`} aria-invalid={!!error} className="min-w-0 flex-1 rounded-lg border border-border bg-bg px-4 py-3 font-mono text-lg focus-visible:outline-2 focus-visible:outline-accent" placeholder={tr("영주 ID 입력")} />
        <button type="submit" disabled={loading} className="rounded-lg bg-accent px-6 py-3 font-bold text-on-accent hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-60">{loading ? tr("조회 중…") : tr("영주 조회")}</button>
      </div>
      <p id="lookup-help" className="mt-3 text-sm text-muted">{tr("게임에서 프로필을 열어 닉네임 아래의 ID를 확인하세요. 숫자 1~15자리를 입력해 주세요.")}</p>
    </form>
      </div>
      <p role="status" className="mt-3 text-sm text-accent">{loading ? tr("영주 정보를 불러오고 있습니다. 정보 갱신에 시간이 걸릴 수 있습니다.") : ''}</p>
      {error && <p id="lookup-error" role="alert" className="mt-2 text-sm text-danger">{playerError(error, locale)}</p>}
    </section>

    {result && player && <div ref={profile} className="space-y-6 scroll-mt-24" aria-label={tr("영주 조회 결과")}>
      <section className={panel} aria-labelledby="profile-title">
        <div className="flex items-center gap-4">
          <Picture src={player.avatar_url} label={player.nick_name ?? tr("영주")} />
          <div className="min-w-0"><h2 id="profile-title" className="break-words text-2xl font-bold [overflow-wrap:anywhere]">{player.nick_name || tr("이름 정보 없음")}</h2><p className="mt-1 break-all text-sm text-muted">{queriedId ? `${tr("영주 ID ")}${queriedId}` : tr("영주 ID 정보 없음")}</p></div>
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3">
          <Stat label={tr("왕국")}>{format(player.kid)}</Stat><Stat label={tr("전투력")}>{format(player.power)}</Stat><Stat label={tr("도시 센터")}>{townLevel(player.town_center_level)}</Stat>
          <Stat label={tr("VIP 레벨")}>{format(player.vip)}</Stat><Stat label={tr("처치 수")}>{format(player.kills)}</Stat>
        </dl>
        <PlayerLocationMap key={JSON.stringify([result.uid, queriedId, player.kid, player.x, player.y])} kid={player.kid} x={player.x} y={player.y} uid={result.uid} onLookup={(value) => { void lookup(value, 'uid', true); }} />
        <div className="mt-6 border-t border-border pt-4 text-sm text-muted">
          {updated ? <p>{tr("갱신 시간 ")}<time dateTime={updated.toISOString()}>{updated.toLocaleString(playerNumberLocale(), { timeZone: 'Asia/Seoul' })}</time>{tr(" (한국 시간)")}</p> : <p>{tr("갱신 시간 정보 없음")}</p>}
          {age !== undefined && age >= 0 && <p className="mt-1">{age < 60 ? tr("1분 이내 갱신") : `${format(Math.floor(age / 60))}${tr("분 전 갱신")}`}</p>}
        </div>
      </section>

      <section className={panel} aria-labelledby="alliance-title">
        <h2 id="alliance-title" className="text-xl font-bold">{tr("연맹")}</h2>
        {alliance ? <><div className="mt-4 flex items-center gap-3"><Picture src={alliance.flag_url} label={tr("연맹")} /><p className="min-w-0 break-words font-bold [overflow-wrap:anywhere]">{alliance.abbr && `[${alliance.abbr}] `}{alliance.name || tr("이름 정보 없음")}</p></div>
          <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3"><Stat label={tr("연맹 ID")}>{hasValue(alliance.aid) ? String(alliance.aid) : '—'}</Stat><Stat label={tr("연맹 전투력")}>{format(alliance.power)}</Stat><Stat label={tr("연맹원 수")}>{format(alliance.count)}</Stat><Stat label={tr("맹주")}>{alliance.leader_name || '—'}</Stat><Stat label={tr("연맹 직위")}>{playerLabel(alliance.rank_label, locale) ?? (hasValue(alliance.rank) ? `${tr("직위 ")}${format(alliance.rank)}` : '—')}</Stat></dl>
        </> : <p className="mt-4 text-muted">{tr("연맹 정보가 없습니다.")}</p>}
      </section>

      {result.ranks && rankLabels.some(([rankKey, valueKey]) => hasValue(result.ranks?.[rankKey]) || hasValue(result.ranks?.[valueKey])) && <section className={panel} aria-labelledby="ranks-title"><h2 id="ranks-title" className="text-xl font-bold">{tr("순위")}</h2><dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">{rankLabels.map(([rankKey, valueKey, label]) => {
        const rank = result.ranks?.[rankKey];
        const value = result.ranks?.[valueKey];
        return hasValue(rank) || hasValue(value) ? <Stat key={rankKey} label={tr(label)}>{hasValue(rank) ? (locale === 'en' ? `#${format(rank)}` : `${format(rank)}위`) : tr("순위 정보 없음")}{hasValue(value) && <span className="mt-1 block text-sm text-muted">{valueKey === 'town_center_level' ? townLevel(value) : format(value)}</span>}</Stat> : null;
      })}</dl></section>}

      <section className={panel} aria-labelledby="governor-gear-title">
        <h2 id="governor-gear-title" className="text-xl font-bold">{tr("영주 장비")}</h2>
        {result.gov_gear?.hidden ? <p className="mt-4 rounded-xl bg-raised p-4 text-muted">{tr("장비를 비공개로 설정한 영주입니다")}</p> : result.gov_gear?.items?.length ? <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{result.gov_gear.items.map((gear, index) => <li key={index} className="min-w-0 rounded-xl border border-border p-4">
          <div className="flex items-center gap-3"><Picture src={gear.icon} label={tr("장비")} /><h3 className="min-w-0 break-words font-bold">{playerLabel(gear.name, locale) ?? (slots[String(gear.slot).toLowerCase()] ? tr(slots[String(gear.slot).toLowerCase()]) : `${tr("영주 장비 ")}${index + 1}`)}</h3></div>
          <dl className="mt-4 grid grid-cols-2 gap-3"><Stat label={tr("등급")}>{tr(grades[String(gear.quality).toLowerCase()] ?? playerLabel(String(gear.quality ?? ''), locale) ?? '—')}</Stat><Stat label={tr("티어")}>{format(gear.tier)}</Stat><Stat label={tr("성급")}>{format(gear.star)}</Stat><Stat label={tr("강화 레벨")}>{format(gear.strength_level)}</Stat><Stat label={tr("장비 점수")}>{format(gear.score)}</Stat><Stat label={tr("전투력")}>{format(gear.combat)}</Stat></dl>
          {gear.gems?.length ? <p className="mt-3 text-sm text-muted">{tr("장착 보석 ")}{gear.gems.length}{tr("개")}</p> : null}
        </li>)}</ul> : <p className="mt-4 text-muted">{tr("공개된 영주 장비 정보가 없습니다.")}</p>}
      </section>

      <ArenaHeroes heroes={result.heroes ?? []} catalog={catalog} />
    </div>}
  </div>;
}
