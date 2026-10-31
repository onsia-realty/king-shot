import type { MapAlliance, MapCity } from '../components/islands/KingdomMapCanvas';
import { readApiJson, RateLimitError, retryAfterSeconds } from './api-response';

export interface MapSnapshot {
  ok: true; kid: number; bounds: { min: number; max: number };
  cities: MapCity[]; alliances: MapAlliance[]; updated_at?: number | string | null;
  source?: string; stale?: boolean; partial?: boolean;
  coverage?: { located: number; total: number; collected_at?: number | string | null };
}
export interface ScanJob { status?: string; job_id?: string | number; progress_pct?: number; tiles_done?: number; tiles_total?: number }
export interface ScanState extends ScanJob {
  ok?: boolean; error?: string; job?: ScanJob | null; queue_position?: number; queue_length?: number;
  cooldown_remaining_sec?: number; ip_cooldown_remaining_sec?: number;
  updates_paused?: boolean; update_available?: boolean; request_token?: string | null;
  last_finished_at?: number;
}
const tokenKey = 'ks-map-update-token';
async function readState(response: Response): Promise<ScanState> {
  // Preserve provider JSON cooldown semantics; WAF HTML must stop polling cleanly.
  let state: ScanState;
  if (response.status === 429) {
    try { state = await response.json(); }
    catch { state = { ok: false, error: new RateLimitError(retryAfterSeconds(response)).message }; }
    if (!state || typeof state !== 'object' || !['cooldown', 'ip_cooldown'].includes(state.error ?? '')) {
      state = { ...state, ok: false, error: new RateLimitError(retryAfterSeconds(response)).message };
    }
  } else state = await response.json();
  if (!state || typeof state !== 'object' || Array.isArray(state)) throw new Error('unknown_status');
  const retry = response.headers.get('Retry-After');
  const seconds = retry ? (/^\d+$/.test(retry) ? Number(retry) : Math.ceil((Date.parse(retry) - Date.now()) / 1000)) : 0;
  if (Number.isFinite(seconds) && seconds > 0) state.cooldown_remaining_sec = Math.max(state.cooldown_remaining_sec ?? 0, seconds);
  return state;
}
let memoryToken: string | undefined;
const validToken = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,160}$/.test(value);
export function scanToken() {
  if (memoryToken) return memoryToken;
  try { const saved = localStorage.getItem(tokenKey); if (validToken(saved)) return memoryToken = saved; } catch { /* Storage may be blocked. */ }
  memoryToken = `t_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  try { localStorage.setItem(tokenKey, memoryToken); } catch { /* Do not rotate on storage failure. */ }
  return memoryToken;
}
export function selectedCity(cities: MapCity[], uid: unknown): MapCity | null {
  return uid == null || String(uid).trim() === '' ? null : cities.find(city => String(city.uid) === String(uid)) ?? null;
}
// Only upstream location timestamps can serve as a map baseline, never DB save times.
export function locationTimestamp(snapshot?: MapSnapshot | null): number | null {
  return snapshot?.source === 'mightpulse' && typeof snapshot.updated_at === 'number'
    && Number.isFinite(snapshot.updated_at) && snapshot.updated_at >= 0 ? snapshot.updated_at : null;
}
export function parseMapSnapshot(data: any, kid: number): MapSnapshot {
  if (!data || data.ok !== true || data.kid !== kid || !Array.isArray(data.cities) || !Array.isArray(data.alliances)
    || !Number.isFinite(data.bounds?.min) || !Number.isFinite(data.bounds?.max) || data.bounds.max <= data.bounds.min
    || !data.cities.every((city: MapCity) => city && /^[1-9]\d*$/.test(String(city.uid))
      && (city.map_kid != null ? city.map_kid === kid : city.kid == null || city.kid === kid)
      && Number.isFinite(city.x) && Number.isFinite(city.y)
      && city.x >= data.bounds.min && city.x <= data.bounds.max && city.y >= data.bounds.min && city.y <= data.bounds.max)
    || !data.alliances.every((alliance: MapAlliance) => alliance && ['string', 'number'].includes(typeof alliance.aid))) throw new Error('snapshot_error');
  return { ...data, cities: data.cities.map((city: MapCity) => ({ ...city,
    city_skin_icon: typeof city.city_skin_icon === 'string'
      && /^(?:https:\/\/mightpulse\.com)?\/assets\/icons\/skin_icon_[0-9]+\.png$/.test(city.city_skin_icon)
      ? new URL(city.city_skin_icon, 'https://mightpulse.com').href : null,
  })) };
}
export async function loadMapSnapshot(kid: number, signal: AbortSignal, fresh = false): Promise<MapSnapshot> {
  const response = await fetch(`/api/map/?kid=${kid}${fresh ? '&fresh=1' : ''}`, { signal, cache: fresh ? 'no-store' : 'default', headers: { Accept: 'application/json' } });
  const data = await readApiJson(response);
  signal.throwIfAborted();
  if (!response.ok) throw new Error('snapshot_error');
  return parseMapSnapshot(data, kid);
}
function delay(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    signal.addEventListener('abort', abort, { once: true });
  });
}
export type RefreshReason = 'cooldown' | 'paused' | 'unavailable' | 'unconfirmed';
// Preflight may skip the mutation or join an existing job. Never retry a POST.
export async function refreshMap(kid: number, signal: AbortSignal, report: (state: ScanState) => void, baseline?: number | null) {
  if (!Number.isInteger(kid) || kid < 1 || kid > 10000) throw new Error('invalid_kid');
  const url = `/api/map-refresh/?kid=${kid}&token=${encodeURIComponent(scanToken())}`;
  async function read(method: 'GET' | 'POST') {
    signal.throwIfAborted();
    const response = await fetch(url, { method, cache: 'no-store', signal, headers: { Accept: 'application/json' } });
    const state = await readState(response);
    signal.throwIfAborted();
    report(state);
    if ((!response.ok || !state.ok) && !['cooldown', 'ip_cooldown', 'updates_paused'].includes(state.error ?? '') && !state.updates_paused) {
      throw new Error(state.error || 'upstream_error');
    }
    return state;
  }
  async function saved(state: ScanState, reason: RefreshReason) {
    return { snapshot: await loadMapSnapshot(kid, signal, true), completed: false, state, reason };
  }
  const active = (state: ScanState) => ['queued', 'running'].includes((state.job ?? state).status ?? '');
  const paused = (state: ScanState) => state.updates_paused || state.error === 'updates_paused';
  const cooling = (state: ScanState) => ['cooldown', 'ip_cooldown'].includes(state.error ?? '')
    || (state.cooldown_remaining_sec ?? 0) > 0 || (state.ip_cooldown_remaining_sec ?? 0) > 0;
  const before = await read('GET');
  if (paused(before)) return saved(before, 'paused');
  if (!active(before) && cooling(before)) return saved(before, 'cooldown');
  if (!active(before) && before.update_available !== true) return saved(before, 'unavailable');
  const times = [baseline, before.last_finished_at].filter((time): time is number => typeof time === 'number' && Number.isFinite(time) && time >= 0);
  const baselineTime = times.length ? Math.max(...times) : null;
  let state = active(before) ? before : await read('POST');
  let jobId = (state.job ?? state).job_id;
  let accepted = active(state) || (state.job ?? state).status === 'done' || jobId != null;
  let publicationReads = 0;
  for (let attempt = 0; attempt <= 60; attempt++) {
    signal.throwIfAborted();
    const current = state.job ?? state;
    const matching = jobId == null || current.job_id === jobId;
    if (jobId != null && current.job_id != null && !matching) throw new Error('scan_replaced');
    if (jobId == null && current.job_id != null) jobId = current.job_id;
    const disappeared = accepted && !state.job && !state.status && state.job_id == null;
    const finishedAdvanced = before.last_finished_at != null && state.last_finished_at != null && state.last_finished_at > before.last_finished_at;
    if ((matching && current.status === 'done') || (disappeared && finishedAdvanced)) {
      const snapshot = await loadMapSnapshot(kid, signal, true);
      const stamp = locationTimestamp(snapshot);
      if (baselineTime != null && stamp != null && stamp > baselineTime && !snapshot.stale && !snapshot.partial) {
        return { snapshot, completed: true, state, reason: undefined };
      }
      // Allow a short publication delay, then return the available map honestly.
      if (baselineTime == null || snapshot.stale || snapshot.partial || ++publicationReads >= 3 || attempt === 60) {
        return { snapshot, completed: false, state, reason: 'unconfirmed' as const };
      }
    } else {
      if (paused(state)) return saved(state, 'paused');
      if (!active(state) && cooling(state)) return saved(state, 'cooldown');
    }
    if (matching && ['failed', 'error', 'cancelled'].includes(current.status ?? '')) throw new Error('scan_failed');
    if (!accepted) throw new Error('unknown_status');
    if (attempt === 60) break;
    await delay(5_000, signal);
    state = await read('GET');
  }
  throw new Error('timeout');
}
