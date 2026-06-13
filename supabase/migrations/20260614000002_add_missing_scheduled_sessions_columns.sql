-- 20260614000002_add_missing_scheduled_sessions_columns.sql
-- Add columns that exist in the full schema CREATE TABLE but were missing
-- ALTER TABLE ADD COLUMN IF NOT EXISTS in the squashed init migration.
-- This ensures the table matches the schema even if created before the type column was added.

ALTER TABLE scheduled_sessions ADD COLUMN IF NOT EXISTS channel_id          TEXT DEFAULT NULL;
ALTER TABLE scheduled_sessions ADD COLUMN IF NOT EXISTS session_name        TEXT NOT NULL DEFAULT 'Diem danh';
ALTER TABLE scheduled_sessions ADD COLUMN IF NOT EXISTS day_of_week         INTEGER DEFAULT NULL;
ALTER TABLE scheduled_sessions ADD COLUMN IF NOT EXISTS hour                INTEGER DEFAULT NULL;
ALTER TABLE scheduled_sessions ADD COLUMN IF NOT EXISTS minute              INTEGER DEFAULT NULL;
ALTER TABLE scheduled_sessions ADD COLUMN IF NOT EXISTS close_day_of_week   INTEGER DEFAULT NULL;
ALTER TABLE scheduled_sessions ADD COLUMN IF NOT EXISTS close_hour          INTEGER DEFAULT NULL;
ALTER TABLE scheduled_sessions ADD COLUMN IF NOT EXISTS close_minute        INTEGER DEFAULT NULL;
ALTER TABLE scheduled_sessions ADD COLUMN IF NOT EXISTS allowed_role_id     TEXT DEFAULT NULL;
ALTER TABLE scheduled_sessions ADD COLUMN IF NOT EXISTS phai_role_ids       TEXT[] DEFAULT '{}';
ALTER TABLE scheduled_sessions ADD COLUMN IF NOT EXISTS is_active           BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE scheduled_sessions ADD COLUMN IF NOT EXISTS skip_until          TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE scheduled_sessions ADD COLUMN IF NOT EXISTS reminder_enabled    BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE scheduled_sessions ADD COLUMN IF NOT EXISTS reminder_1_min      INTEGER NOT NULL DEFAULT 30;
ALTER TABLE scheduled_sessions ADD COLUMN IF NOT EXISTS reminder_2_min      INTEGER NOT NULL DEFAULT 10;
ALTER TABLE scheduled_sessions ADD COLUMN IF NOT EXISTS scheduled_date      DATE DEFAULT NULL;
ALTER TABLE scheduled_sessions ADD COLUMN IF NOT EXISTS type                TEXT NOT NULL DEFAULT 'recurring_weekly'
  CHECK (type IN ('recurring_weekly', 'one_time'));
