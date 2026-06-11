-- 20260611000002_add_missing_dashboard_columns.sql
-- Columns added via Supabase dashboard that aren't in the init migration.
-- Idempotent (IF NOT EXISTS).

-- ── guild_configs (dashboard-added columns) ───────────────────────────────────
ALTER TABLE guild_configs ADD COLUMN IF NOT EXISTS admin_role_name     TEXT DEFAULT NULL;
ALTER TABLE guild_configs ADD COLUMN IF NOT EXISTS allowed_role_id     TEXT DEFAULT NULL;
ALTER TABLE guild_configs ADD COLUMN IF NOT EXISTS allowed_role_name   TEXT DEFAULT NULL;
ALTER TABLE guild_configs ADD COLUMN IF NOT EXISTS reminder_enabled    BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE guild_configs ADD COLUMN IF NOT EXISTS reminder_minutes    INTEGER NOT NULL DEFAULT 10;

-- ── attendances ──────────────────────────────────────────────────────────────
ALTER TABLE attendances ADD COLUMN IF NOT EXISTS late_minutes INTEGER DEFAULT NULL;

-- ── sessions ─────────────────────────────────────────────────────────────────
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS role_name TEXT DEFAULT '';
