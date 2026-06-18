-- Create distributed lock table for attendance (replaces in-memory Map)
CREATE TABLE IF NOT EXISTS attendance_locks (
  session_id  uuid  NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id     text  NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, user_id)
);

-- Auto-cleanup locks older than 60 seconds (stale from crashed instances)
CREATE OR REPLACE FUNCTION cleanup_stale_locks()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM attendance_locks WHERE created_at < now() - interval '60 seconds';
END;
$$;

-- RLS: service_role only
ALTER TABLE attendance_locks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON attendance_locks;
CREATE POLICY "service_role_all" ON attendance_locks
  FOR ALL TO service_role USING (true) WITH CHECK (true);
