-- Create distributed lock table for scheduler leadership (multi-instance safety)
CREATE TABLE IF NOT EXISTS scheduler_locks (
  job_name    text PRIMARY KEY,
  instance_id text NOT NULL,
  locked_until timestamptz NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- RLS: service_role only
ALTER TABLE scheduler_locks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON scheduler_locks;
CREATE POLICY "service_role_all" ON scheduler_locks
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Atomic lock acquire: returns true if caller now owns the lock
--   p_job_name     — logical lock name (e.g. 'scheduler_leader')
--   p_instance_id  — unique instance identifier (hostname+pid)
--   p_ttl_seconds  — lock duration in seconds (e.g. 70)
CREATE OR REPLACE FUNCTION try_acquire_scheduler_lock(
  p_job_name text,
  p_instance_id text,
  p_ttl_seconds int
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_existing record;
BEGIN
  -- Try insert — if row doesn't exist, we own it
  INSERT INTO scheduler_locks (job_name, instance_id, locked_until)
  VALUES (p_job_name, p_instance_id, now() + (p_ttl_seconds || ' seconds')::interval)
  ON CONFLICT (job_name) DO NOTHING
  RETURNING * INTO v_existing;

  IF FOUND THEN
    RETURN true;
  END IF;

  -- Row exists — lock with row-level exclusive access
  SELECT * INTO v_existing
  FROM scheduler_locks
  WHERE job_name = p_job_name
  FOR UPDATE;

  -- Already our instance → renew
  IF v_existing.instance_id = p_instance_id THEN
    UPDATE scheduler_locks
    SET locked_until = now() + (p_ttl_seconds || ' seconds')::interval,
        updated_at   = now()
    WHERE job_name = p_job_name;
    RETURN true;
  END IF;

  -- Lock expired → take over
  IF v_existing.locked_until < now() THEN
    UPDATE scheduler_locks
    SET instance_id  = p_instance_id,
        locked_until = now() + (p_ttl_seconds || ' seconds')::interval,
        updated_at   = now()
    WHERE job_name = p_job_name;
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- Release lock (graceful shutdown)
CREATE OR REPLACE FUNCTION release_scheduler_lock(
  p_job_name text,
  p_instance_id text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM scheduler_locks
  WHERE job_name = p_job_name AND instance_id = p_instance_id;
END;
$$;
