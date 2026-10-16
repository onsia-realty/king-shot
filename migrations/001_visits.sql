-- Run once against the Neon database before enabling the API. Safe to re-run.
-- Application requests never create tables. No individual visitor data is stored.
BEGIN;
CREATE TABLE IF NOT EXISTS public.visits_total (
  namespace text PRIMARY KEY CHECK (namespace IN ('production', 'development')),
  count bigint NOT NULL DEFAULT 0 CHECK (count >= 0)
);
CREATE TABLE IF NOT EXISTS public.visits_daily (
  namespace text NOT NULL CHECK (namespace IN ('production', 'development')),
  day date NOT NULL,
  count bigint NOT NULL DEFAULT 0 CHECK (count >= 0),
  PRIMARY KEY (namespace, day)
);
COMMIT;
