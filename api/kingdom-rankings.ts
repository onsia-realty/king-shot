import type { IncomingMessage, ServerResponse } from 'node:http';
import { allowRequest } from '../src/lib/server/same-site.js';

const BOARD_TYPES = {
  personal_power: 3, kills: 4, hero_total: 8, hero_equip: 13,
  gov_gear: 14, gov_charm: 15, pet_power: 16, mystic_trial: 20,
} as const;
type Board = keyof typeof BOARD_TYPES;
const ROW_LIMIT = 100;
const CACHE_LIMIT = 100;
const TTL = 5 * 60 * 1000;
const TIMEOUT = 30_000;
type RankingRow = {
  rank: number;
  uid: string | null;
  governor_id: string | null;
  nick_name: string;
  score: number;
  kid: number;
  alliance_abbr: string | null;
  avatar_url: string | null;
};
type PublicRankings = {
  ok: true;
  kid: number;
  board: Board;
  captured_at: number | null;
  rows: RankingRow[];
};
const cache = new Map<string, { data: PublicRankings; storedAt: number }>();
const pending = new Map<string, Promise<PublicRankings>>();
const errors = {
  invalid_method: [405, 'GET 요청만 지원합니다.'],
  invalid_kid: [400, '왕국 번호를 1~10000 사이의 정수로 입력해 주세요.'],
  invalid_board: [400, '지원하는 순위 항목을 하나만 선택해 주세요.'],
  missing_key: [503, '왕국 순위 조회 서비스가 아직 설정되지 않았습니다.'],
  not_found: [404, '해당 왕국의 순위를 찾을 수 없습니다.'],
  upstream_auth: [502, '왕국 순위 조회 서비스 인증에 문제가 있습니다.'],
  rate_limited: [429, '조회 요청이 많습니다. 잠시 후 다시 시도해 주세요.'],
  timeout: [504, '왕국 순위 조회 시간이 초과되었습니다. 다시 시도해 주세요.'],
  upstream_error: [502, '왕국 순위를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'],
} as const;
type ErrorCode = keyof typeof errors;
class LookupError extends Error {
  constructor(public code: ErrorCode) { super(code); }
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function text(value: unknown, limit: number): string | null {
  if (typeof value !== 'string') return null;
  return value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, limit) || null;
}
function id(value: unknown): string | null {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value <= 0) return null;
    value = String(value);
  }
  if (typeof value === 'string' && /^[0-9]{1,15}$/.test(value) && !/^0+$/.test(value)) {
    return value.replace(/^0+/, '');
  }
  return null;
}
function avatar(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048 || /[\u0000-\u0020\u007f]/.test(value)) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
function normalize(data: unknown, kid: number, board: Board): PublicRankings {
  if (!object(data) || data.ok !== true || data.kid !== kid || data.limit !== ROW_LIMIT
    || !object(data.board) || data.board.key !== board || data.board.type !== BOARD_TYPES[board]
    || data.board.kind !== 'player' || data.board.limit !== ROW_LIMIT
    || !Array.isArray(data.board.rows) || data.board.rows.length > ROW_LIMIT
    || data.board.count !== data.board.rows.length) throw new LookupError('upstream_error');
  const ranks = new Set<number>();
  const rows = data.board.rows.map((row: unknown): RankingRow => {
    if (!object(row) || typeof row.rank !== 'number' || !Number.isInteger(row.rank)
      || row.rank < 1 || row.rank > ROW_LIMIT || ranks.has(row.rank)
      || typeof row.score !== 'number' || !Number.isFinite(row.score) || row.score < 0
      || row.kid !== kid) throw new LookupError('upstream_error');
    const name = text(row.nick_name, 200);
    if (!name) throw new LookupError('upstream_error');
    ranks.add(row.rank);
    return {
      rank: row.rank, uid: id(row.uid), governor_id: id(row.governor_id),
      nick_name: name, score: row.score, kid,
      alliance_abbr: text(row.alliance_abbr, 32), avatar_url: avatar(row.avatar_url),
    };
  });
  const captured = data.board.captured_at;
  return {
    ok: true, kid, board,
    captured_at: typeof captured === 'number' && Number.isFinite(captured) && captured >= 0 ? captured : null,
    rows,
  };
}
function sendError(res: ServerResponse, code: ErrorCode) {
  res.statusCode = errors[code][0];
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify({ ok: false, error: code, message: errors[code][1] }));
}
async function lookup(kid: number, board: Board, key: string): Promise<PublicRankings> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new LookupError('timeout'));
    }, TIMEOUT);
  });
  try {
    return await Promise.race([expired, (async () => {
      const response = await fetch(
        `https://api.mightpulse.com/v1/kingdoms/${kid}/ranks?board=${board}&limit=${ROW_LIMIT}`,
        { headers: { Authorization: `Bearer ${key}`,
          'User-Agent': 'kingshot-gongryak-site/1.0 (+https://xn--ob0bx7rdoh9mq.xyz)', Accept: 'application/json' },
        signal: controller.signal, redirect: 'error' },
      );
      if (!response.ok) {
        // Provider error bodies may contain credentials or private diagnostics. Never read or log them.
        throw new LookupError(response.status === 404 ? 'not_found'
          : response.status === 401 || response.status === 403 ? 'upstream_auth'
          : response.status === 429 ? 'rate_limited' : 'upstream_error');
      }
      return normalize(await response.json(), kid, board);
    })()]);
  } finally { clearTimeout(timer); }
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!allowRequest(req, res)) return;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendError(res, 'invalid_method');
  }
  let kid: number;
  let board: Board;
  try {
    const params = new URL(req.url ?? '', 'http://localhost').searchParams;
    const value = params.get('kid') ?? '';
    if (params.getAll('kid').length !== 1 || !/^[0-9]{1,5}$/.test(value)
      || Number(value) < 1 || Number(value) > 10000) return sendError(res, 'invalid_kid');
    kid = Number(value);
    const requestedBoard = params.get('board') ?? 'mystic_trial';
    if (params.getAll('board').length > 1 || !Object.prototype.hasOwnProperty.call(BOARD_TYPES, requestedBoard)) {
      return sendError(res, 'invalid_board');
    }
    board = requestedBoard as Board;
  } catch { return sendError(res, 'invalid_kid'); }
  const key = process.env.MIGHTPULSE_API_KEY?.trim();
  if (!key) return sendError(res, 'missing_key');
  const cacheKey = `${kid}:${board}`;
  try {
    const now = Date.now();
    for (const [entryKey, entry] of cache) {
      if (now - entry.storedAt >= TTL) cache.delete(entryKey);
    }
    let entry = cache.get(cacheKey);
    if (!entry) {
      let work = pending.get(cacheKey);
      if (!work) {
        if (pending.size >= CACHE_LIMIT) return sendError(res, 'rate_limited');
        work = lookup(kid, board, key).then(data => {
          if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!);
          cache.set(cacheKey, { data, storedAt: Date.now() });
          return data;
        }).finally(() => { pending.delete(cacheKey); });
        pending.set(cacheKey, work);
      }
      const data = await work;
      entry = cache.get(cacheKey) ?? { data, storedAt: Date.now() };
    }
    const elapsed = Math.max(0, Date.now() - entry.storedAt);
    const secondsLeft = Math.max(0, Math.floor((TTL - elapsed) / 1000));
    res.statusCode = 200;
    res.setHeader('Cache-Control', `public, max-age=0, s-maxage=${secondsLeft}`);
    res.end(JSON.stringify(entry.data));
  } catch (error) {
    sendError(res, error instanceof LookupError ? error.code : 'upstream_error');
  }
}
