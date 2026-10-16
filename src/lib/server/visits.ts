import { neon } from '@neondatabase/serverless';
import type { IncomingMessage, ServerResponse } from 'node:http';

export function kstDate(now = new Date()): string {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// One SQL statement is one transaction: both increments commit or neither does.
// Updating total first serializes concurrent writers, including at the KST boundary.
export const RECORD_VISIT = `
WITH total AS (
  INSERT INTO public.visits_total (namespace, count) VALUES ($1, 1)
  ON CONFLICT (namespace) DO UPDATE SET count = public.visits_total.count + 1
  RETURNING count
), daily AS (
  INSERT INTO public.visits_daily (namespace, day, count)
  SELECT $1, $2::date, 1 FROM total
  ON CONFLICT (namespace, day) DO UPDATE SET count = public.visits_daily.count + 1
  RETURNING count
)
SELECT daily.count::text AS today, total.count::text AS total FROM daily CROSS JOIN total
`;
export const READ_VISITS = `
SELECT
  COALESCE((SELECT count FROM public.visits_daily WHERE namespace = $1 AND day = $2::date), 0)::text AS today,
  COALESCE((SELECT count FROM public.visits_total WHERE namespace = $1), 0)::text AS total
`;

export async function visitCounts(date: string, record = false, namespace: 'production' | 'development' = 'production') {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error('storage_unavailable');
  const sql = neon(url);
  const rows = await sql.query(record ? RECORD_VISIT : READ_VISITS, [namespace, date], {
    fetchOptions: { signal: AbortSignal.timeout(5000) },
  });
  if (rows.length !== 1) throw new Error('storage_unavailable');
  const values = [rows[0].today, rows[0].total].map((value: unknown) => {
    if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new Error('storage_unavailable');
    const count = Number(value);
    if (!Number.isSafeInteger(count)) throw new Error('storage_unavailable');
    return count;
  });
  return { today: values[0] as number, total: values[1] as number };
}

export async function visitsHandler(req: IncomingMessage, res: ServerResponse) {
  const date = kstDate();
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store');
  const send = (status: number, body: Record<string, unknown>) => {
    res.statusCode = status;
    res.end(JSON.stringify({ today: null, total: null, date, ...body }));
  };
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return send(405, { ok: false, error: 'invalid_method' });
  }
  const host = req.headers.host || '';
  const localHost = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host);
  const local = localHost && process.env.VISITS_ALLOW_LOCAL === 'true' && process.env.VERCEL_ENV !== 'production';
  if (req.method === 'POST' && (req.headers.origin !== `${local ? 'http' : 'https'}://${host}`
    || (req.headers['sec-fetch-site'] && req.headers['sec-fetch-site'] !== 'same-origin'))) {
    return send(403, { ok: false, error: 'invalid_origin' });
  }
  // Explicit localhost tests use a separate namespace; previews never touch production counts.
  if (!local && (process.env.VERCEL_ENV !== 'production' || !host || localHost)) {
    return send(503, { ok: false, error: 'disabled' });
  }
  if (!(process.env.DATABASE_URL || process.env.POSTGRES_URL)) {
    return send(503, { ok: false, error: 'storage_unavailable' });
  }
  try {
    return send(200, { ok: true, ...await visitCounts(date, req.method === 'POST', local ? 'development' : 'production') });
  } catch {
    return send(503, { ok: false, error: 'storage_unavailable' });
  }
}
