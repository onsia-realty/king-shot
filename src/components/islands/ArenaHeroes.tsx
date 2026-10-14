import { useLocale } from '../../lib/locale';
import { playerText, playerNumberLocale, playerLabel, playerStatLabel, playerStatValue, type PlayerLocale } from '../../lib/player-localization';
import { useEffect, useState, type ReactNode } from 'react';

type Scalar = string | number | null;
export type HeroCatalog = Record<string, { name: string; nameEn?: string; image?: string; gearName?: string; gearNameEn?: string; gearImage?: string }>;
export interface ArenaHeroGear {
  eid?: Scalar; sid?: Scalar; slot?: Scalar; name?: string | null;
  enhancement_level?: Scalar; refine_level?: Scalar; gear_level?: Scalar;
  quality?: Scalar; quality_key?: string | null; quality_label?: string | null;
  red?: boolean | null; troop?: Scalar; troop_label?: string | null;
}
export interface ArenaHero {
  id?: Scalar; name?: string | null; icon?: string | null; level?: Scalar;
  star?: Scalar; stars?: Scalar; star_label?: string | null; position?: Scalar;
  skill_levels?: { id?: Scalar; level?: Scalar }[] | null;
  exclusive_gear_level?: Scalar;
  exclusive_gear?: {
    id?: Scalar; name?: string | null; level?: Scalar; slot?: Scalar;
    slg_attr?: { id?: Scalar; value?: Scalar; label?: string | null }[] | null;
  } | null;
  gear?: ArenaHeroGear[] | null;
}

const slots = ['helmet', 'gloves', 'armor', 'boots'] as const;
type Slot = 'exclusive' | typeof slots[number];
const slotLabels: Record<Slot, string> = { exclusive: '전용 장비', helmet: '투구', gloves: '장갑', armor: '갑옷', boots: '신발' };
const grades: Record<string, string> = { common: '일반', uncommon: '고급', rare: '레어', epic: '에픽', mythic: '신화', legendary: '전설', mythic_red: '신화' };
const qualityKeys: Record<string, string> = { '1': 'common', '2': 'uncommon', '3': 'rare', '4': 'epic', '5': 'mythic' };
const qualityColors: Record<string, string> = {
  common: 'border-slate-400 bg-gradient-to-br from-slate-400 to-slate-600',
  uncommon: 'border-green-400 bg-gradient-to-br from-green-400 to-green-700',
  rare: 'border-blue-400 bg-gradient-to-br from-blue-400 to-blue-700',
  epic: 'border-purple-400 bg-gradient-to-br from-purple-400 to-purple-700',
  mythic: 'border-amber-300 bg-gradient-to-br from-amber-300 to-yellow-700',
  red: 'border-red-300 bg-gradient-to-br from-red-400 to-red-700',
};
const troops: Record<string, { name: string; icon: string; color: string }> = {
  infantry: { name: '보병', icon: 'infantry', color: 'bg-class-infantry' },
  cavalry: { name: '기병', icon: 'cavalry', color: 'bg-class-cavalry' },
  archer: { name: '궁병', icon: 'archer', color: 'bg-class-archer' },
};
const troopKeys: Record<string, string> = { '1': 'infantry', '2': 'cavalry', '3': 'archer', lancer: 'cavalry', 보병: 'infantry', 기병: 'cavalry', 궁병: 'archer' };
function numeric(value: unknown): number | undefined {
  if (value === null || value === undefined || (typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}
const level = (value: unknown) => numeric(value)?.toLocaleString(playerNumberLocale()) ?? '—';
function exclusiveName(hero: ArenaHero, known: HeroCatalog[string] | undefined, locale: PlayerLocale) {
  return (locale === 'en' ? known?.gearNameEn : undefined)
    ?? playerLabel(known?.gearName, locale) ?? playerLabel(hero.exclusive_gear?.name, locale)
    ?? playerText('전용 장비', locale);
}
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
function safeImage(value?: string | null, local = false) {
  if (!value) return undefined;
  if (local && value.startsWith('/') && !value.startsWith('//')) return value;
  try { const url = new URL(value, 'https://mightpulse.com'); return url.protocol === 'https:' ? url.href : undefined; }
  catch { return undefined; }
}
function equipmentIcon(id?: Scalar) {
  return id !== null && id !== undefined && /^[1-9]\d{0,14}$/.test(String(id))
    ? `https://mightpulse.com/assets/icons/equipment_icon_${id}.png` : undefined;
}
function Icon({ src, label, fallback, className = '' }: { src?: string; label: string; fallback: ReactNode; className?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return src && !failed
    ? <img src={src} alt={label} loading="lazy" onError={() => setFailed(true)} className={className} />
    : <>{fallback}</>;
}
function SlotIcon({ slot }: { slot: Slot }) {
  const paths: Record<Slot, string> = {
    exclusive: 'M7 27 25 9l5-3-3 5L9 29m9-17 6 6M5 31l4-2-2-2-2 4',
    helmet: 'M8 25V16a10 10 0 0 1 20 0v9l-7-3v7h-6v-7l-7 3Zm10-19v12',
    gloves: 'm11 30-4-12 3-2 3 5V8l3-1 1 12V6h3l1 13 1-11 3 1v12l3-6 3 2-4 13Z',
    armor: 'm12 6-8 7 5 5 3-3v15h12V15l3 3 5-5-8-7-6 5-6-5Z',
    boots: 'M14 6h12l-2 16 7 4v5H9v-7l5-3V6Z',
  };
  return <svg viewBox="0 0 36 36" className="size-9 text-white/90" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d={paths[slot]} /></svg>;
}
function Stars({ hero }: { hero: ArenaHero }) {
  const { locale } = useLocale();
  const tr = (text: string) => playerText(text, locale);
  const value = numeric(hero.star);
  const raw = value !== undefined && Number.isInteger(value) && value <= 30 ? value : undefined;
  const api = numeric(hero.stars);
  const complete = raw === 30 ? 5 : api !== undefined && api <= 5 && Number.isInteger(api) ? api : raw !== undefined ? Math.floor(raw / 6) : undefined;
  const petals = raw !== undefined && raw < 30 ? raw % 6 : 0;
  const label = complete === undefined ? tr("성급 정보 없음") : raw !== undefined && raw < 30 ? `${complete}${tr("성 · ")}${petals}${tr("단계")}` : `${complete}${tr("성")}`;
  return <div className="mt-1">
    <div className="flex w-fit gap-1 rounded-md border border-border bg-raised px-2 py-1" role="img" aria-label={label}>
      {Array.from({ length: 5 }, (_, index) => <svg key={index} viewBox="0 0 24 24" className="size-5" aria-hidden="true">
        {Array.from({ length: 6 }, (_, petal) => <path key={petal} d="M12 2 14.2 8.5 12 11 9.8 8.5Z" transform={`rotate(${petal * 60} 12 12)`} fill={complete !== undefined && (index < complete || (index === complete && petal < petals)) ? '#f7c245' : '#46525f'} />)}
        <circle cx="12" cy="12" r="2" fill={complete !== undefined && (index < complete || (index === complete && petals > 0)) ? '#ffd27a' : '#46525f'} />
      </svg>)}
    </div>
    <p className="mt-1 text-xs text-muted">{label}</p>
  </div>;
}
function gearSlot(gear: ArenaHeroGear): string {
  const slot = String(gear.slot ?? '').toLowerCase();
  if (slots.includes(slot as typeof slots[number])) return slot;
  // Numeric equipment IDs encode the four slots as 101 / 102 / 103 / 104.
  const prefix = String(gear.eid ?? '').slice(0, 3);
  return ({ '101': 'helmet', '102': 'gloves', '103': 'armor', '104': 'boots' } as Record<string, string>)[prefix] ?? slot;
}
function GearTile({ slot, gear, hero, known }: { slot: Slot; gear?: ArenaHeroGear; hero: ArenaHero; known?: HeroCatalog[string] }) {
  const { locale } = useLocale();
  const tr = (text: string) => playerText(text, locale);
  const exclusive = slot === 'exclusive';
  const present = exclusive ? !!hero.exclusive_gear || numeric(hero.exclusive_gear_level) !== undefined : !!gear;
  const qualityValue = String(gear?.quality_key ?? gear?.quality ?? '').toLowerCase();
  const quality = qualityKeys[qualityValue] ?? qualityValue;
  const red = gear?.red === true || quality === 'legendary' || quality === 'mythic_red' || (numeric(gear?.enhancement_level) ?? 0) >= 101;
  const grade = exclusive ? tr("전용 장비") : playerLabel(gear?.quality_label, locale) ?? tr(grades[quality] ?? '등급 미확인');
  const color = present ? qualityColors[exclusive ? 'mythic' : red ? 'red' : quality] ?? 'border-border bg-raised' : 'border-border bg-bg';
  const troopValue = String(gear?.troop ?? gear?.troop_label ?? '').toLowerCase();
  const troop = troops[troopKeys[troopValue] ?? troopValue] ?? troops[troopKeys[gear?.troop_label ?? '']];
  const name = exclusive ? exclusiveName(hero, known, locale) : playerLabel(gear?.name, locale) ?? tr(slotLabels[slot]);
  const exclusiveLevel = hero.exclusive_gear?.level ?? hero.exclusive_gear_level;
  const title = present ? `${name} · ${tr(slotLabels[slot])}${troop ? ` · ${tr(troop.name)}` : ''} · ${grade}${red ? tr(" · 빨간색") : ''} · ${exclusive ? `${tr("레벨 ")}${level(exclusiveLevel)}` : `${tr("강화 ")}${level(gear?.enhancement_level)}${tr(" · 제련 ")}${level(gear?.refine_level)}${tr(" · 장비 레벨 ")}${level(gear?.gear_level)}`}` : `${tr(slotLabels[slot])}${tr(" · 장비 정보 없음")}`;
  const src = exclusive ? safeImage(known?.gearImage, true) ?? equipmentIcon(hero.exclusive_gear?.id) : equipmentIcon(gear?.eid);
  return <li className="min-w-0">
    <div title={title} role="img" aria-label={title} className={`relative flex aspect-square min-h-[50px] items-center justify-center rounded-lg border shadow-inner ${color}`}>
      <Icon src={present ? src : undefined} label="" className="h-full w-full object-contain p-1.5 pb-4" fallback={<SlotIcon slot={slot} />} />
      {troop && <span className={`absolute -left-1 -top-1 flex size-4 items-center justify-center rounded-md border border-white/60 ${troop.color}`}><Icon src={`https://mightpulse.com/static/troop-types/${troop.icon}.webp`} label="" className="size-full object-contain" fallback={<span className="text-[9px] font-bold text-bg">{tr(troop.name)[0]}</span>} /></span>}
      {!exclusive && numeric(gear?.enhancement_level) !== undefined && <span className="absolute right-0.5 top-0.5 rounded bg-bg/85 px-1 text-[10px] font-bold leading-4 text-white">+{level(gear?.enhancement_level)}</span>}
      <span className="absolute inset-x-0 bottom-0.5 text-center text-[10px] font-bold leading-4 text-white [text-shadow:0_1px_3px_#000]">{present ? exclusive ? `${tr("레벨 ")}${level(exclusiveLevel)}` : `${tr("제련 ")}${level(gear?.refine_level)}` : tr("미확인")}</span>
    </div>
    <p className="mt-1 truncate text-center text-[10px] text-muted">{tr(slotLabels[slot])}</p>
  </li>;
}

export default function ArenaHeroes({ heroes, catalog }: { heroes: ArenaHero[] | null | undefined; catalog: HeroCatalog }) {
  const { locale } = useLocale();
  const tr = (text: string) => playerText(text, locale);
  const ordered = [...(heroes ?? [])].sort((a, b) => (numeric(a.position) ?? Infinity) - (numeric(b.position) ?? Infinity));
  return <section className="min-w-0 rounded-2xl border border-border bg-surface p-4 sm:p-6" aria-labelledby="heroes-title">
    <h2 id="heroes-title" className="text-xl font-bold">{tr("아레나 방어 영웅")}</h2>
    {ordered.length ? <ul className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{ordered.map((hero, index) => {
      const known = catalog[normalize(hero.name ?? '')] ?? catalog[String(hero.id ?? '')];
      const name = (locale === 'en' ? known?.nameEn : undefined) ?? playerLabel(known?.name, locale) ?? playerLabel(hero.name, locale) ?? `${tr("방어 영웅 ")}${index + 1}`;
      const exclusiveLevel = hero.exclusive_gear?.level ?? hero.exclusive_gear_level;
      return <li key={`${hero.id ?? 'hero'}-${index}`} className="min-w-0 rounded-xl border border-border border-t-accent/70 bg-bg p-3">
        <div className="flex items-start gap-3">
          <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-accent/30 bg-raised text-xl text-accent"><Icon src={safeImage(known?.image, true) ?? safeImage(hero.icon)} label={name} className="size-full object-cover" fallback={<span aria-hidden="true">{name[0]}</span>} /></div>
          <div className="min-w-0 flex-1"><h3 className="break-words font-bold">{name}</h3><Stars hero={hero} /></div>
        </div>
        <dl className="mt-3 space-y-1 text-xs">
          <div className="flex justify-between gap-2"><dt className="text-muted">{tr("영웅 레벨")}</dt><dd className="font-semibold">{level(hero.level)}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-muted">{tr("전용 장비 레벨")}</dt><dd className="font-semibold">{level(exclusiveLevel)}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-muted">{tr("방어 편성")}</dt><dd className="font-semibold">{level(hero.position)}</dd></div>
        </dl>
        <ul className="mt-4 grid grid-cols-5 gap-1.5" aria-label={`${name}${tr(" 장비")}`}>
          <GearTile slot="exclusive" hero={hero} known={known} />
          {slots.map((slot) => <GearTile key={slot} slot={slot} gear={hero.gear?.find((gear) => gearSlot(gear) === slot)} hero={hero} known={known} />)}
        </ul>
        <details className="mt-3 border-t border-border pt-2 text-xs">
          <summary className="cursor-pointer text-muted focus-visible:outline-2 focus-visible:outline-accent">{tr("장비 상세")}</summary>
          <div className="mt-2 space-y-2">
            <p>{exclusiveName(hero, known, locale)}{tr(" · 레벨 ")}{level(exclusiveLevel)}</p>
            {hero.exclusive_gear?.slg_attr?.map((attr, i) => <p key={i}>{playerStatLabel(attr.label, attr.id, locale)}: {playerStatValue(attr.value, locale)}</p>)}
            {hero.gear?.map((gear, i) => {
              const quality = String(gear.quality_key ?? gear.quality ?? '').toLowerCase();
              const grade = playerLabel(gear.quality_label, locale) ?? tr(grades[qualityKeys[quality] ?? quality] ?? '등급 미확인');
              return <p key={i}>{tr(slotLabels[gearSlot(gear) as Slot] ?? '장비')} · {grade}{tr(" · 강화 ")}{level(gear.enhancement_level)}{tr(" · 제련 ")}{level(gear.refine_level)}{tr(" · 장비 레벨 ")}{level(gear.gear_level)}</p>;
            })}
            {hero.skill_levels?.length ? <ul className="flex flex-wrap gap-1">{hero.skill_levels.map((skill, i) => <li key={i} className="rounded bg-raised px-2 py-1">{tr("스킬 ")}{i + 1}{tr(" · 레벨 ")}{level(skill.level)}</li>)}</ul> : null}
          </div>
        </details>
      </li>;
    })}</ul> : <p className="mt-4 text-muted">{tr("아레나 방어 영웅 정보가 없습니다.")}</p>}
  </section>;
}
