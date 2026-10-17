import { useEffect, useRef, useState } from 'react';
import { useLocale } from '../../lib/locale';
import { rateLimitMessage, RateLimitError } from '../../lib/api-response';
import { refreshMap, type MapSnapshot, type ScanState } from '../../lib/map-refresh';

export default function MapRefresh({ kid, baseline, disabled = false, onSnapshot }: {
  kid: number; baseline?: number | null; disabled?: boolean; onSnapshot: (snapshot: MapSnapshot, completed: boolean) => void;
}) {
  const { locale } = useLocale();
  const en = locale === 'en';
  const request = useRef<AbortController | null>(null);
  const receive = useRef(onSnapshot);
  receive.current = onSnapshot;
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<ScanState | null>(null);
  const [outcome, setOutcome] = useState('');
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    return () => { request.current?.abort(); request.current = null; };
  }, [kid]);
  useEffect(() => { if (disabled) { request.current?.abort(); request.current = null; setBusy(false); } }, [disabled]);
  useEffect(() => {
    if (!until) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [until]);
  const remaining = Math.max(0, Math.ceil((until - now) / 1000));
  async function start() {
    if (request.current || disabled || remaining) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true); setState(null); setOutcome('');
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 300_000);
    try {
      const result = await refreshMap(kid, controller.signal, next => {
        if (request.current !== controller) return;
        setState(next);
        const seconds = Math.max(next.cooldown_remaining_sec ?? 0, next.ip_cooldown_remaining_sec ?? 0);
        if (seconds > 0) { setUntil(Date.now() + seconds * 1000); setNow(Date.now()); }
      }, baseline);
      if (controller.signal.aborted || request.current !== controller) return;
      receive.current(result.snapshot, result.completed);
      setOutcome(result.completed ? 'done' : 'saved');
    } catch (error) {
      if (request.current === controller && !controller.signal.aborted && error instanceof RateLimitError && error.retryAfterSeconds > 0) {
        setUntil(Date.now() + error.retryAfterSeconds * 1000); setNow(Date.now());
      }
      if (request.current === controller) setOutcome(timedOut ? 'timeout' : controller.signal.aborted ? 'cancelled' : error instanceof Error ? error.message : 'upstream_error');
    } finally {
      clearTimeout(timer);
      if (request.current === controller) { request.current = null; setBusy(false); }
    }
  }
  const job = state?.job ?? state;
  const percent = job?.progress_pct ?? (job?.tiles_total && job.tiles_done != null ? job.tiles_done / job.tiles_total * 100 : null);
  const message = busy ? job?.status === 'queued'
    ? (en ? `Queued${state?.queue_position != null ? ` · position ${state.queue_position}` : ''}` : `대기 중${state?.queue_position != null ? ` · 순서 ${state.queue_position}` : ''}`)
    : job?.status === 'running' ? (en ? 'Scanning map…' : '지도 재수집 중…') : (en ? 'Requesting / loading map…' : '요청 / 지도 불러오는 중…')
    : outcome === 'done' ? (en ? 'Scan completed. Latest saved coordinates loaded.' : '재수집 완료. 최신 저장 좌표를 불러왔습니다.')
    : outcome === 'saved' ? (en ? 'Latest saved map loaded; no new scan completed.' : '최신 저장 지도를 불러왔습니다. 새 재수집이 완료된 것은 아닙니다.')
    : outcome === 'cancelled' ? (en ? 'Stopped waiting. The upstream scan may continue.' : '대기를 중지했습니다. 제공처의 재수집은 계속될 수 있습니다.')
    : outcome === 'timeout' ? (en ? 'Stopped waiting after 5 minutes. The scan may still be queued or running.' : '5분이 지나 대기를 중지했습니다. 재수집이 대기 중이거나 진행 중일 수 있습니다.')
    : outcome ? rateLimitMessage(outcome, locale) ?? (en ? 'Could not refresh the map. Try again later.' : '지도를 새로고침하지 못했습니다. 잠시 후 다시 시도해 주세요.') : '';
  return <div className="space-y-2" data-testid="map-refresh">
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" data-testid="map-refresh-start" className="rounded-lg border border-border bg-raised px-3 py-2 text-sm disabled:opacity-40" disabled={disabled || busy || remaining > 0} onClick={() => void start()}>{en ? 'Refresh map' : '지도 새로고침'}</button>
      {busy && <button type="button" data-testid="map-refresh-cancel" className="rounded-lg border border-border px-3 py-2 text-sm" onClick={() => request.current?.abort()}>{en ? 'Stop waiting' : '대기 중지'}</button>}
      {remaining > 0 && <span className="text-xs text-muted">{en ? `Cooldown: ${remaining}s` : `재요청 대기: ${remaining}초`}</span>}
    </div>
    {message && <p role="status" data-testid="map-refresh-status" className="text-sm text-muted">{message}{busy && percent != null && Number.isFinite(percent) ? ` ${Math.round(Math.max(0, Math.min(100, percent)))}%` : ''}</p>}
    {state?.updates_paused && <p className="text-xs text-muted">{en ? 'Map updates are paused by the provider.' : '제공처가 지도 갱신을 일시 중지했습니다.'}</p>}
    {(state?.error === 'ip_cooldown' || (state?.ip_cooldown_remaining_sec ?? 0) > 0) && <p className="text-xs text-muted">{en ? 'Other visitors’ refresh requests may also cause a waiting period.' : '다른 이용자의 갱신 요청으로 대기 시간이 적용될 수 있습니다.'}</p>}
  </div>;
}
