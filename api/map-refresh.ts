import { kingdom, storeHandler } from '../src/lib/server/mightpulse-discovery.js';
import { status } from '../src/lib/server/kingdom-store.js';

// GET reports the collector's progress; POST records a refresh request. The old `token` param is accepted and ignored.
export default storeHandler(10, async (params, req) => {
  const kid = kingdom(params)!;
  const post = req.method === 'POST';
  const body = { ok: true, kid, ...await status(kid, post), job: null, request_token: null,
    mighty: false, updates_paused: false, update_available: false };
  // A request only queues the kingdom for the collector (at most every 6 h). Reporting it as a one-hour
  // cooldown makes the client reload the saved map once and stop polling instead of waiting for a job.
  return [200, post ? { ...body, ok: false, error: 'cooldown', status: 'queued', cooldown_remaining_sec: 3600, cooldown_total_sec: 3600 } : body];
}, ['GET', 'POST']);
