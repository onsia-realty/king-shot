import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocale } from '../../lib/locale';
import { rateLimitMessage, RateLimitError } from '../../lib/api-response';
import { refreshMap, type MapSnapshot, type ScanState } from '../../lib/map-refresh';

interface Props {
  kid: number; selectedUID?: string; baseline?: number | null; disabled?: boolean; children?: ReactNode;
  onSnapshot: (snapshot: MapSnapshot, completed: boolean) => void;
  onBusyChange?: (busy: boolean) => boolean | void;
}
export default function MapRefresh(props: Props) {
  return <MapRefreshScope key={JSON.stringify([props.kid, props.selectedUID])} {...props} />;
}

export function MapRefreshScope({ kid, selectedUID, baseline, disabled = false, onSnapshot, onBusyChange, children }: Props) {
  const { locale } = useLocale();
  const en = locale === 'en';
  const request = useRef<AbortController | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const receive = useRef(onSnapshot);
  receive.current = onSnapshot;
  const notify = useRef(onBusyChange);
  notify.current = onBusyChange;
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<ScanState | null>(null);
  const [outcome, setOutcome] = useState('');
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    return () => {
      const wasBusy = request.current !== null;
      request.current?.abort(); request.current = null;
      if (timeout.current) clearTimeout(timeout.current);
      if (wasBusy) notify.current?.(false);
    };
  }, []);
  useEffect(() => {
    if (!until) return;
    const timer = setInterval(() => {
      const time = Date.now(); setNow(time);
      if (time >= until) { setUntil(0); clearInterval(timer); }
    }, 1000);
    return () => clearInterval(timer);
  }, [until]);
  const remaining = Math.max(0, Math.ceil((until - now) / 1000));
  const countdown = en
    ? `${remaining >= 60 ? `${Math.floor(remaining / 60)}m ` : ''}${remaining % 60}s`
    : `${remaining >= 60 ? `${Math.floor(remaining / 60)}분 ` : ''}${remaining % 60}초`;
  async function start() {
    if (request.current || disabled || Date.now() < until || notify.current?.(true) === false) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true); setState(null); setOutcome('');
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 300_000);
    timeout.current = timer;
    try {
      const result = await refreshMap(kid, controller.signal, next => {
        if (request.current !== controller || controller.signal.aborted) return;
        setState(next);
        const seconds = Math.max(next.cooldown_remaining_sec ?? 0, next.ip_cooldown_remaining_sec ?? 0);
        setUntil(seconds > 0 ? Date.now() + seconds * 1000 : 0); setNow(Date.now());
      }, baseline);
      if (controller.signal.aborted || request.current !== controller) return;
      receive.current(result.snapshot, result.completed);
      setOutcome(result.completed ? 'done' : result.reason ?? 'unconfirmed');
    } catch (error) {
      if (request.current === controller && !controller.signal.aborted && error instanceof RateLimitError && error.retryAfterSeconds > 0) {
        setUntil(Date.now() + error.retryAfterSeconds * 1000); setNow(Date.now());
      }
      if (request.current === controller) setOutcome(timedOut ? 'timeout' : controller.signal.aborted ? 'cancelled' : error instanceof Error ? error.message : 'upstream_error');
    } finally {
      clearTimeout(timer);
      if (timeout.current === timer) timeout.current = null;
      if (request.current === controller) { request.current = null; setBusy(false); notify.current?.(false); }
    }
  }
  function cancel() {
    request.current?.abort(); request.current = null;
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = null; setBusy(false); setOutcome('cancelled'); notify.current?.(false);
  }
  const job = state?.job ?? state;
  const percent = job?.progress_pct ?? (job?.tiles_total && job.tiles_done != null ? job.tiles_done / job.tiles_total * 100 : null);
  const message = busy ? job?.status === 'queued'
    ? (en ? `Waiting for the map scan${state?.queue_position != null ? ` · position ${state.queue_position}` : ''}` : `지도 수집 대기 중${state?.queue_position != null ? ` · 순서 ${state.queue_position}` : ''}`)
    : job?.status === 'running' ? (en ? 'Finding current city positions…' : '도시 위치를 수집하는 중…') : (en ? 'Checking availability / loading map…' : '갱신 가능 여부 확인 / 지도 불러오는 중…')
    : outcome === 'done' ? (en ? 'Scan completed. Updated map positions loaded.' : '지도 수집이 완료되어 갱신된 위치를 불러왔습니다.')
    : outcome === 'cooldown' ? (en ? 'Please wait before requesting another scan. Showing the available saved map.' : '다음 위치 수집까지 기다려 주세요. 지금은 불러올 수 있는 저장 지도를 표시합니다.')
    : outcome === 'paused' ? (en ? 'Map updates are paused. Showing the available saved map.' : '지도 갱신이 일시 중지되어 저장 지도를 표시합니다.')
    : outcome === 'unavailable' ? (en ? 'A new scan is not available yet. Showing the available saved map.' : '아직 새 위치 수집을 요청할 수 없어 저장 지도를 표시합니다.')
    : outcome === 'unconfirmed' ? (en ? 'A newer complete map could not be confirmed. Showing the available saved map.' : '위치 시각이 갱신된 전체 지도를 확인하지 못했습니다. 지금은 불러올 수 있는 저장 지도를 표시합니다.')
    : outcome === 'cancelled' ? (en ? 'Stopped waiting. An already started scan may continue.' : '대기를 중지했습니다. 이미 시작된 위치 수집은 계속될 수 있습니다.')
    : outcome === 'timeout' ? (en ? 'Stopped waiting after 5 minutes. The scan may still be queued or running.' : '5분이 지나 대기를 중지했습니다. 위치 수집이 대기 중이거나 진행 중일 수 있습니다.')
    : outcome ? rateLimitMessage(outcome, locale) ?? (en ? 'Could not update map positions. Try again later.' : '지도 위치를 갱신하지 못했습니다. 잠시 후 다시 시도해 주세요.') : '';
  return <div className="space-y-2" data-testid="map-refresh">
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" data-testid="map-refresh-start" className="rounded-lg bg-accent px-4 py-3 font-bold text-on-accent disabled:opacity-40" disabled={disabled || busy || remaining > 0} onClick={() => void start()}>{selectedUID ? (en ? 'Latest location' : '최신 위치 찾기') : (en ? 'Update map' : '지도 최신화')}</button>
      {busy && <button type="button" data-testid="map-refresh-cancel" className="rounded-lg border border-border px-3 py-2 text-sm" onClick={cancel}>{en ? 'Stop waiting' : '대기 중지'}</button>}
      {children}
      {remaining > 0 && <span className="text-xs text-muted">{en ? `Next request in ${countdown}` : `다음 요청까지 ${countdown}`}</span>}
    </div>
    {message && <p role="status" data-testid="map-refresh-status" className="text-sm text-muted">{message}{busy && percent != null && Number.isFinite(percent) ? ` ${Math.round(Math.max(0, Math.min(100, percent)))}%` : ''}</p>}
  </div>;
}
