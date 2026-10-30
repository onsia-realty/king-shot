-- Neon 에 한 번만 손으로 실행한다. 다시 실행해도 안전하다(IF NOT EXISTS).
-- API 핸들러와 수집 스크립트는 테이블을 만들지 않는다.
-- 왕국 지도·이름 검색용 데이터. scripts/collect-kingdoms.mjs 가 채우고 api/map·api/search 가 읽는다.
BEGIN;

-- Fresh-table migration; validate/apply separately. Never run collectors concurrently
-- (including manual runs and scheduled runs). HTTP queries do not hold a session lock.
-- Least-recently-attempted kingdom first; timestamps below are NOT whole-kingdom completion.
CREATE TABLE IF NOT EXISTS public.kingdom_requests (
  kid integer PRIMARY KEY CHECK (kid BETWEEN 1 AND 100000),
  requested_at timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 1,
  collected_at timestamptz,            -- last successful roster/profile storage
  ranks_at timestamptz,
  last_attempt_at timestamptz,
  located integer NOT NULL DEFAULT 0,  -- x,y 를 아는 플레이어 수
  total integer NOT NULL DEFAULT 0     -- 명단에 있는 플레이어 수
);

-- 연맹 파워 랭킹(/kingdoms/{kid}/ranks?board=alliance_power) 상위 100개.
CREATE TABLE IF NOT EXISTS public.alliances (
  aid bigint PRIMARY KEY,
  kid integer NOT NULL,
  abbr text,
  name text,
  power bigint,
  member_count integer,
  leader_name text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  roster_at timestamptz,               -- checkpoint only after atomic roster upsert
  roster_attempted_at timestamptz      -- failures go behind unattempted alliances
);
CREATE INDEX IF NOT EXISTS alliances_kid_idx ON public.alliances (kid);

-- 연맹 명단(/alliances/{kid}/{abbr}?include=roster) + 개별 프로필(/players/{uid}) 의 좌표.
-- kid is roster membership. profile_kid is the actual kingdom returned by the profile.
-- Coordinates are publishable only when these agree; war-server positions are not home cities.
-- located_at is our successful check (including 404), NOT the provider cache timestamp.
CREATE TABLE IF NOT EXISTS public.players (
  uid bigint PRIMARY KEY CHECK (uid > 0),
  governor_id bigint,
  kid integer NOT NULL,
  nick_name text NOT NULL,
  power bigint,
  tc integer,
  aid bigint,
  alliance_abbr text,
  avatar_url text,
  x double precision CHECK (x BETWEEN 0 AND 1200),
  y double precision CHECK (y BETWEEN 0 AND 1200),
  shield_endtime double precision,
  burn_endtime double precision,
  roster_at timestamptz NOT NULL DEFAULT now(),
  located_at timestamptz,
  profile_kid integer,
  profile_cached_at timestamptz,
  profile_attempted_at timestamptz,
  CHECK ((x IS NULL) = (y IS NULL)),
  CHECK (x IS NULL OR (profile_kid IS NOT NULL AND profile_kid = kid))
);
CREATE INDEX IF NOT EXISTS players_kid_idx ON public.players (kid);
CREATE INDEX IF NOT EXISTS players_nick_lower_idx ON public.players (lower(nick_name));
CREATE INDEX IF NOT EXISTS players_profile_queue_idx ON public.players (kid, profile_attempted_at);

COMMIT;
