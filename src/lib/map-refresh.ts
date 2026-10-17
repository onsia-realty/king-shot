import type { MapAlliance, MapCity } from '../components/islands/KingdomMapCanvas';
import { readApiJson, RateLimitError, retryAfterSeconds } from './api-response';

export interface MapSnapshot {
  ok: boolean; kid: number; bounds: { min: number; max: number };
  cities: MapCity[]; alliances: MapAlliance[]; updated_at?: number | null;
}
export interface ScanJob { status?: string; job_id?: string | number; progress_pct?: number; tiles_done?: number; tiles_total?: number }
export interface ScanState extends ScanJob {
  ok?: boolean; error?: string; job?: ScanJob | null; queue_position?: number; queue_length?: number;
  cooldown_remaining_sec?: number; ip_cooldown_remaining_sec?: number;
  updates_paused?: boolean; request_token?: string | null;
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
  const retry = response.headers.get('Retry-After');
  const seconds = retry ? (/^\d+$/.test(retry) ? Number(retry) : Math.ceil((Date.parse(retry) - Date.now()) / 1000)) : 0;
  if (Number.isFinite(seconds) && seconds > 0) state.cooldown_remaining_sec = Math.max(state.cooldown_remaining_sec ?? 0, seconds);
  return state;
}
let memoryToken: string | undefined;
const validToken = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,160}$/.test(value);
export function scanToken(replacement?: string | null) {
  if (validToken(replacement)) {
    memoryToken = replacement;
    try { localStorage.setItem(tokenKey, replacement); } catch { /* Keep the same token in memory. */ }
  }
  if (memoryToken) return memoryToken;
  try { const saved = localStorage.getItem(tokenKey); if (validToken(saved)) return memoryToken = saved; } catch { /* Storage may be blocked. */ }
  memoryToken = `t_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  try { localStorage.setItem(tokenKey, memoryToken); } catch { /* Do not rotate on storage failure. */ }
  return memoryToken;
}
export function selectedCity(cities: MapCity[], uid: unknown): MapCity | null {
  return uid == null || String(uid).trim() === '' ? null : cities.find(city => String(city.uid) === String(uid)) ?? null;
}
export async function loadMapSnapshot(kid: number, signal: AbortSignal, fresh = false): Promise<MapSnapshot> {
  const response = await fetch(`/api/map/?kid=${kid}${fresh ? '&fresh=1' : ''}`, { signal, cache: fresh ? 'no-store' : 'default', headers: { Accept: 'application/json' } });
  const data = await readApiJson(response);
  if (!response.ok || !data?.ok || data.kid !== kid || !Array.isArray(data.cities) || !Array.isArray(data.alliances)
    || !Number.isFinite(data.bounds?.min) || !Number.isFinite(data.bounds?.max) || data.bounds.max <= data.bounds.min) throw new Error('snapshot_error');
  return data;
}
function delay(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    signal.addEventListener('abort', abort, { once: true });
  });
}
// One explicit POST per click. Polling never starts or retries a mutation.
export async function refreshMap(kid: number, signal: AbortSignal, report: (state: ScanState) => void, baseline?: number | null) {
  if (!Number.isInteger(kid) || kid < 1 || kid > 10000) throw new Error('invalid_kid');
  const preflight = await fetch(`/api/map-refresh/?kid=${kid}&token=${encodeURIComponent(scanToken())}`,
    { method: 'GET', cache: 'no-store', signal, headers: { Accept: 'application/json' } });
  const before = await readState(preflight);
  scanToken(before.request_token);
  if (!preflight.ok || !before.ok) { report(before); throw new Error(before.error || 'upstream_error'); }
  const baselineTime = baseline == null ? before.last_finished_at : Math.max(baseline, before.last_finished_at ?? baseline);
  let jobId: string | number | undefined;
  let accepted = false;
  for (let attempt = 0; attempt <= 60; attempt++) {
    signal.throwIfAborted();
    const response = await fetch(`/api/map-refresh/?kid=${kid}&token=${encodeURIComponent(scanToken())}`,
      { method: attempt === 0 ? 'POST' : 'GET', cache: 'no-store', signal, headers: { Accept: 'application/json' } });
    const state = await readState(response);
    scanToken(state.request_token);
    signal.throwIfAborted();
    report(state);
    if (state.error === 'cooldown' || state.error === 'ip_cooldown' || state.updates_paused) {
      return { snapshot: await loadMapSnapshot(kid, signal, true), completed: false, state };
    }
    if (!response.ok || !state.ok) throw new Error(state.error || 'upstream_error');
    const current = state.job ?? state;
    if (attempt === 0) { jobId = current.job_id; accepted = ['queued', 'running', 'done'].includes(current.status ?? '') || jobId != null; }
    const matching = jobId == null || current.job_id === jobId;
    if (jobId != null && current.job_id != null && !matching) throw new Error('scan_replaced');
    const disappeared = accepted && !state.job && !state.status && state.job_id == null;
    const finishedAdvanced = before.last_finished_at != null && state.last_finished_at != null && state.last_finished_at > before.last_finished_at;
    if ((matching && current.status === 'done') || (disappeared && finishedAdvanced)) {
      const snapshot = await loadMapSnapshot(kid, signal, true);
      // Without a prior timestamp, return saved data without claiming a new collection.
      if (baselineTime == null && matching && current.status === 'done') {
        return { snapshot, completed: false, state };
      }
      // A completed job can precede publication of its snapshot, or our short cache can still be warm.
      if (baselineTime != null && snapshot.updated_at != null && snapshot.updated_at > baselineTime) {
        return { snapshot, completed: true, state };
      }
    }
    if (matching && ['failed', 'error', 'cancelled'].includes(current.status ?? '')) throw new Error('scan_failed');
    if (!accepted) throw new Error('unknown_status');
    if (attempt === 60) break;
    await delay(5_000, signal);
  }
  throw new Error('timeout');
}
