-- 20260810000001_fix_scheduler_locks_columns.sql
-- Reconcile scheduler_locks created from an older/dashboard source whose columns
-- were named acquired_at/expires_at, while the bot RPCs (try_acquire_scheduler_lock,
-- release_scheduler_lock) expect locked_until/updated_at. Idempotent: each step
-- only runs when the legacy column/constraint actually exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='scheduler_locks' AND column_name='expires_at'
  ) THEN
    ALTER TABLE scheduler_locks RENAME COLUMN expires_at TO locked_until;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='scheduler_locks' AND column_name='acquired_at'
  ) THEN
    ALTER TABLE scheduler_locks RENAME COLUMN acquired_at TO updated_at;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'scheduler_locks_pkey'
      AND conrelid = 'public.scheduler_locks'::regclass
  ) THEN
    ALTER TABLE scheduler_locks ADD CONSTRAINT scheduler_locks_pkey PRIMARY KEY (job_name);
  END IF;
END $$;

ALTER TABLE scheduler_locks ALTER COLUMN locked_until SET NOT NULL;
ALTER TABLE scheduler_locks ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE scheduler_locks ALTER COLUMN updated_at SET NOT NULL;
