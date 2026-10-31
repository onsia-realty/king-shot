import type { IncomingMessage, ServerResponse } from 'node:http';
import { DiscoveryError, kingdom, number, object } from '../src/lib/server/mightpulse-discovery.js';
import { allowRequest } from '../src/lib/server/same-site.js';

const tokenPattern = /^[a-zA-Z0-9_-]{1,160}$/;
const numericFields = ['cooldown_remaining_sec', 'cooldown_total_sec', 'last_finished_at',
  'ip_cooldown_remaining_sec', 'ip_cooldown_total_sec', 'queue_position', 'queue_length',
  'progress_pct', 'tiles_done', 'tiles_total'] as const;
const statuses = ['queued', 'running', 'done', 'failed', 'error', 'cancelled'];
const errors = ['cooldown', 'ip_cooldown', 'rate_limited', 'updates_paused'];
function job(data: Record<string, unknown>) {
  const result: Record<string, unknown> = {};
  if (typeof data.status === 'string' && statuses.includes(data.status)) result.status = data.status;
  if ((typeof data.job_id === 'string' && tokenPattern.test(data.job_id))
    || (typeof data.job_id === 'number' && Number.isSafeInteger(data.job_id) && data.job_id > 0)) result.job_id = data.job_id;
  for (const field of numericFields) {
    const n = number(data[field]);
    if (data[field] === null) result[field] = null;
    else if (n !== null && n >= 0 && n <= Number.MAX_SAFE_INTEGER && (field !== 'progress_pct' || n <= 100)) result[field] = n;
  }
  return result;
}
function retryAfter(value: string | null): string | null {
  if (!value) return null;
  if (/^\d{1,8}$/.test(value)) return value;
  // Forward only an HTTP date, never arbitrary strings parsed permissively as dates.
  if (/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(value)
    && Number.isFinite(Date.parse(value))) return value;
  return null;
}
let active = 0;
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!allowRequest(req, res)) return;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  const send = (status: number, data: unknown) => { res.statusCode = status; res.end(JSON.stringify(data)); };
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return send(405, { ok: false, error: 'invalid_method' });
  }
  let kid: number;
  let token: string;
  try {
    const query = new URL(req.url ?? '', 'http://localhost').searchParams;
    kid = kingdom(query)!;
    token = query.get('token') ?? '';
    if (query.getAll('token').length !== 1 || !tokenPattern.test(token)) return send(400, { ok: false, error: 'invalid_token' });
  } catch (error) { return send(400, { ok: false, error: error instanceof DiscoveryError ? error.code : 'invalid_kid' }); }
  if (active >= 10) return send(429, { ok: false, error: 'rate_limited' });
  active++;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('timeout')); }, 10_000); }),
      (async () => {
        // One public request, with a stable caller token. Never forward credentials,
        // cookies, client IPs, arbitrary headers or a POST body; never retry a POST.
        const response = await fetch(`https://mightpulse.com/api/map/update${req.method === 'GET' ? '/status' : ''}?kid=${kid}&token=${encodeURIComponent(token)}`,
          { method: req.method, redirect: 'error', signal: controller.signal, headers: {
            'User-Agent': 'kingshot-gongryak-site/1.0 (+https://xn--ob0bx7rdoh9mq.xyz)', Accept: 'application/json',
          } });
        const retry = retryAfter(response.headers.get('Retry-After'));
        const failed = () => ({ status: response.status === 429 ? 429 : 502, retry,
          data: { ok: false, error: response.status === 429 ? 'rate_limited' : 'upstream_error' } });
        if (response.status === 401 || response.status === 403
          || !/^application\/(?:json|[\w.-]+\+json)(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '')) return failed();
        let raw: unknown;
        try { raw = await response.json(); } catch { return failed(); }
        if (!object(raw) || typeof raw.ok !== 'boolean' || (raw.kid !== undefined && raw.kid !== kid)
          || (raw.job != null && !object(raw.job))
          || (object(raw.job) && raw.job.kid !== undefined && raw.job.kid !== kid)) return failed();
        const data: Record<string, unknown> = { ...job(raw), ok: response.ok && raw.ok, kid };
        for (const field of ['mighty', 'updates_paused', 'update_available']) if (typeof raw[field] === 'boolean') data[field] = raw[field];
        data.job = object(raw.job) ? job(raw.job) : null;
        data.request_token = typeof raw.request_token === 'string' && tokenPattern.test(raw.request_token) ? raw.request_token : null;
        if (!data.ok) data.error = typeof raw.error === 'string' && errors.includes(raw.error)
          ? raw.error : response.status === 429 ? 'rate_limited' : 'upstream_error';
        return { status: response.ok ? response.status : response.status === 429 ? 429 : 502, data, retry };
      })(),
    ]);
    // No asynchronous upstream work may mutate response headers after a timeout.
    if (result.retry) res.setHeader('Retry-After', result.retry);
    return send(result.status, result.data);
  } catch {
    return send(controller.signal.aborted ? 504 : 502, { ok: false, error: controller.signal.aborted ? 'timeout' : 'upstream_error' });
  } finally { clearTimeout(timer); active--; }
}
