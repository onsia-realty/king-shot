import type { IncomingMessage, ServerResponse } from 'node:http';
import { DiscoveryError, kingdom, number, object } from '../src/lib/server/mightpulse-discovery.js';
import { allowRequest } from '../src/lib/server/same-site.js';

const tokenPattern = /^[a-zA-Z0-9_-]{1,160}$/;
const numericFields = ['kid', 'cooldown_remaining_sec', 'cooldown_total_sec', 'last_finished_at',
  'ip_cooldown_remaining_sec', 'ip_cooldown_total_sec', 'queue_position', 'queue_length',
  'progress_pct', 'tiles_done', 'tiles_total'] as const;
const statuses = ['queued', 'running', 'done', 'failed', 'error', 'cancelled'];
function job(data: Record<string, unknown>) {
  const result: Record<string, unknown> = {};
  if (typeof data.status === 'string' && statuses.includes(data.status)) result.status = data.status;
  if ((typeof data.job_id === 'string' && /^[\w-]{1,160}$/.test(data.job_id))
    || (typeof data.job_id === 'number' && Number.isSafeInteger(data.job_id))) result.job_id = data.job_id;
  for (const field of numericFields) if (number(data[field]) !== null) result[field] = data[field];
  return result;
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
      new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('timeout')); }, 30_000); }),
      (async () => {
        // Public map routes: never forward cookies, credentials, client IPs or arbitrary headers.
        const response = await fetch(`https://mightpulse.com/api/map/update${req.method === 'GET' ? '/status' : ''}?kid=${kid}&token=${encodeURIComponent(token)}`,
          { method: req.method, redirect: 'error', signal: controller.signal });
        const retry = response.headers.get('Retry-After');
        if (retry && (/^\d{1,8}$/.test(retry) || Number.isFinite(Date.parse(retry)))) res.setHeader('Retry-After', retry);
        let raw: unknown;
        try { raw = await response.json(); } catch { return { status: response.status === 429 ? 429 : 502, data: { ok: false, error: response.status === 429 ? 'rate_limited' : 'upstream_error' } }; }
        if (!object(raw) || typeof raw.ok !== 'boolean') throw new Error('upstream_error');
        const data: Record<string, unknown> = { ...job(raw), ok: response.ok && raw.ok, kid };
        for (const field of ['mighty', 'updates_paused', 'update_available']) if (typeof raw[field] === 'boolean') data[field] = raw[field];
        data.job = object(raw.job) ? job(raw.job) : null;
        data.request_token = typeof raw.request_token === 'string' && tokenPattern.test(raw.request_token) ? raw.request_token : null;
        if (!data.ok) data.error = ['cooldown', 'ip_cooldown', 'rate_limited', 'updates_paused'].includes(String(raw.error))
          ? raw.error : response.status === 429 ? 'rate_limited' : 'upstream_error';
        return { status: response.ok ? 200 : response.status === 429 ? 429 : 502, data };
      })(),
    ]);
    return send(result.status, result.data);
  } catch (error) { return send(controller.signal.aborted ? 504 : 502, { ok: false, error: controller.signal.aborted ? 'timeout' : 'upstream_error' }); }
  finally { clearTimeout(timer); active--; }
}
