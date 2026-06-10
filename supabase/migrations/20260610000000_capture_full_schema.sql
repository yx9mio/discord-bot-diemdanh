-- 20260610000000_capture_full_schema.sql
-- Captures ALL tables, columns, constraints, triggers, RLS policies
-- that exist in the Supabase project but were applied via dashboard
-- before CLI adoption. Idempotent (IF NOT EXISTS) for safety.

-- ── 1. guild_configs ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS guild_configs (
  guild_id                TEXT        PRIMARY KEY,
  timezone                TEXT        NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  notification_channel_id TEXT        DEFAULT NULL,
  log_channel_id          TEXT        DEFAULT NULL,
  admin_role_id           TEXT        DEFAULT NULL,
  attendance_role_id      TEXT        DEFAULT NULL,
  default_role_id         TEXT        DEFAULT NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE guild_configs ADD COLUMN IF NOT EXISTS admin_role_id          TEXT DEFAULT NULL;
ALTER TABLE guild_configs ADD COLUMN IF NOT EXISTS attendance_role_id     TEXT DEFAULT NULL;
ALTER TABLE guild_configs ADD COLUMN IF NOT EXISTS log_channel_id         TEXT DEFAULT NULL;
ALTER TABLE guild_configs ADD COLUMN IF NOT EXISTS default_role_id        TEXT DEFAULT NULL;

ALTER TABLE guild_configs DROP COLUMN IF EXISTS schedules;
ALTER TABLE guild_configs DROP COLUMN IF EXISTS auto_schedule_enabled;

COMMENT ON COLUMN guild_configs.admin_role_id IS 'Role duoc quyen quan ly bot';
COMMENT ON COLUMN guild_configs.attendance_role_id IS 'Role bat buoc de diem danh';

CREATE OR REPLACE FUNCTION update_guild_configs_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_guild_configs_updated_at ON guild_configs;
CREATE TRIGGER trg_guild_configs_updated_at
  BEFORE UPDATE ON guild_configs FOR EACH ROW EXECUTE FUNCTION update_guild_configs_updated_at();

ALTER TABLE guild_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON guild_configs;
CREATE POLICY "service_role_all" ON guild_configs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── 2. sessions ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id             TEXT         NOT NULL,
  session_name         TEXT         DEFAULT NULL,
  started_by           TEXT         DEFAULT NULL,
  is_active            BOOLEAN      NOT NULL DEFAULT true,
  cancelled            BOOLEAN      NOT NULL DEFAULT false,
  channel_id           TEXT         DEFAULT NULL,
  message_id           TEXT         DEFAULT NULL,
  eligible_member_ids  TEXT[]       DEFAULT NULL,
  allowed_role_id      TEXT         DEFAULT NULL,
  phai_role_ids        TEXT[]       DEFAULT NULL,
  auto_close_at        TIMESTAMPTZ  DEFAULT NULL,
  started_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  ended_at             TIMESTAMPTZ  DEFAULT NULL,
  description          TEXT         DEFAULT NULL
);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS phai_role_ids TEXT[] DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_guild ON sessions (guild_id);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions (guild_id, is_active) WHERE is_active = true;

COMMENT ON COLUMN sessions.phai_role_ids IS 'Danh sach role IDs dung de filter thanh vien khi mo phien';

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON sessions;
CREATE POLICY "service_role_all" ON sessions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── 3. attendances ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendances (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     UUID         NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  guild_id       TEXT         NOT NULL,
  user_id        TEXT         NOT NULL,
  username       TEXT         DEFAULT NULL,
  status         TEXT         NOT NULL DEFAULT 'tham_gia',
  marked_by      TEXT         DEFAULT NULL,
  checked_in_at  TIMESTAMPTZ  DEFAULT NULL
);

ALTER TABLE attendances DROP CONSTRAINT IF EXISTS attendances_session_id_key;
ALTER TABLE attendances DROP CONSTRAINT IF EXISTS attendances_user_id_key;
ALTER TABLE attendances ADD CONSTRAINT IF NOT EXISTS attendances_session_user_unique UNIQUE (session_id, user_id);

CREATE INDEX IF NOT EXISTS idx_attendances_session ON attendances (session_id);
CREATE INDEX IF NOT EXISTS idx_attendances_guild ON attendances (guild_id);
CREATE INDEX IF NOT EXISTS idx_attendances_user ON attendances (user_id);

ALTER TABLE attendances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON attendances;
CREATE POLICY "service_role_all" ON attendances
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── 4. members ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS members (
  id          BIGSERIAL    PRIMARY KEY,
  guild_id    TEXT         NOT NULL,
  user_id     TEXT         NOT NULL,
  username    TEXT         DEFAULT NULL,
  phong_ban   TEXT         DEFAULT NULL,
  ghi_chu     TEXT         DEFAULT NULL,
  joined_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (guild_id, user_id)
);
ALTER TABLE members ADD COLUMN IF NOT EXISTS ghi_chu TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_members_guild ON members (guild_id);
CREATE INDEX IF NOT EXISTS idx_members_guild_user ON members (guild_id, user_id);

CREATE OR REPLACE FUNCTION update_members_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_members_updated_at ON members;
CREATE TRIGGER trg_members_updated_at
  BEFORE UPDATE ON members FOR EACH ROW EXECUTE FUNCTION update_members_updated_at();

ALTER TABLE members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON members;
CREATE POLICY "service_role_all" ON members
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── 5. member_stats ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS member_stats (
  id                BIGSERIAL    PRIMARY KEY,
  guild_id          TEXT         NOT NULL,
  user_id           TEXT         NOT NULL,
  current_streak    INTEGER      NOT NULL DEFAULT 0,
  best_streak       INTEGER      NOT NULL DEFAULT 0,
  total_joined      INTEGER      NOT NULL DEFAULT 0,
  total_sessions    INTEGER      NOT NULL DEFAULT 0,
  total_late        INTEGER      NOT NULL DEFAULT 0,
  total_excused     INTEGER      NOT NULL DEFAULT 0,
  total_absent      INTEGER      NOT NULL DEFAULT 0,
  last_session_id   UUID         DEFAULT NULL,
  last_attended_at  TIMESTAMPTZ  DEFAULT NULL,
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (guild_id, user_id)
);
ALTER TABLE member_stats ADD COLUMN IF NOT EXISTS total_late       INTEGER NOT NULL DEFAULT 0;
ALTER TABLE member_stats ADD COLUMN IF NOT EXISTS total_excused    INTEGER NOT NULL DEFAULT 0;
ALTER TABLE member_stats ADD COLUMN IF NOT EXISTS total_absent     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE member_stats ADD COLUMN IF NOT EXISTS last_attended_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_member_stats_guild ON member_stats (guild_id);
CREATE INDEX IF NOT EXISTS idx_member_stats_guild_user ON member_stats (guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_member_stats_guild_total ON member_stats (guild_id, total_joined DESC);
CREATE INDEX IF NOT EXISTS idx_member_stats_guild_streak ON member_stats (guild_id, current_streak DESC);

CREATE OR REPLACE FUNCTION update_member_stats_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_member_stats_updated_at ON member_stats;
CREATE TRIGGER trg_member_stats_updated_at
  BEFORE UPDATE ON member_stats FOR EACH ROW EXECUTE FUNCTION update_member_stats_updated_at();

ALTER TABLE member_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON member_stats;
CREATE POLICY "service_role_all" ON member_stats
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── 6. badges + member_badges ───────────────────────────────────
CREATE TABLE IF NOT EXISTS badges (
  id         SERIAL       PRIMARY KEY,
  guild_id   TEXT         NOT NULL,
  threshold  INTEGER      NOT NULL,
  emoji      TEXT         NOT NULL DEFAULT '🏅',
  label      TEXT         NOT NULL,
  created_at TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE (guild_id, threshold)
);
CREATE INDEX IF NOT EXISTS idx_badges_guild ON badges (guild_id);

CREATE TABLE IF NOT EXISTS member_badges (
  id         SERIAL       PRIMARY KEY,
  guild_id   TEXT         NOT NULL,
  user_id    TEXT         NOT NULL,
  threshold  INTEGER      NOT NULL,
  earned_at  TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE (guild_id, user_id, threshold)
);
CREATE INDEX IF NOT EXISTS idx_member_badges_guild_user ON member_badges (guild_id, user_id);

-- FK: member_badges.threshold + guild_id → badges — enables PostgREST join
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'member_badges_guild_threshold_fkey'
  ) THEN
    ALTER TABLE member_badges
      ADD CONSTRAINT member_badges_guild_threshold_fkey
      FOREIGN KEY (guild_id, threshold) REFERENCES badges(guild_id, threshold)
      ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON badges;
CREATE POLICY "service_role_all" ON badges
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE member_badges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON member_badges;
CREATE POLICY "service_role_all" ON member_badges
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── 7. scheduled_sessions ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS scheduled_sessions (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id            TEXT         NOT NULL,
  channel_id          TEXT         DEFAULT NULL,
  session_name        TEXT         NOT NULL DEFAULT 'Diem danh',
  day_of_week         INTEGER      DEFAULT NULL,
  hour                INTEGER      DEFAULT NULL,
  minute              INTEGER      DEFAULT NULL,
  close_day_of_week   INTEGER      DEFAULT NULL,
  close_hour          INTEGER      DEFAULT NULL,
  close_minute        INTEGER      DEFAULT NULL,
  pre_close_minutes   INTEGER      NOT NULL DEFAULT 30 CHECK (pre_close_minutes >= 0 AND pre_close_minutes <= 180),
  allowed_role_id     TEXT         DEFAULT NULL,
  phai_role_ids       TEXT[]       DEFAULT NULL,
  is_active           BOOLEAN      NOT NULL DEFAULT true,
  skip_until          TIMESTAMPTZ  DEFAULT NULL,
  reminder_enabled    BOOLEAN      NOT NULL DEFAULT true,
  reminder_1_min      INTEGER      NOT NULL DEFAULT 30,
  reminder_2_min      INTEGER      NOT NULL DEFAULT 10,
  scheduled_date      DATE         DEFAULT NULL,
  type                TEXT         NOT NULL DEFAULT 'recurring_weekly'
    CHECK (type IN ('recurring_weekly', 'one_time')),
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE scheduled_sessions ADD COLUMN IF NOT EXISTS pre_close_minutes INTEGER NOT NULL DEFAULT 30
  CHECK (pre_close_minutes >= 0 AND pre_close_minutes <= 180);
ALTER TABLE scheduled_sessions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE scheduled_sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_scheduled_sessions_guild ON scheduled_sessions (guild_id);

COMMENT ON COLUMN scheduled_sessions.pre_close_minutes IS
  'So phut dong phien diem danh TRUOC gio mo. VD: phien 20:00, pre_close=30 -> dong DD luc 19:30. Default 30.';

ALTER TABLE scheduled_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON scheduled_sessions;
CREATE POLICY "service_role_all" ON scheduled_sessions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── 8. reminders (legacy scheduler) ─────────────────────────────
CREATE TABLE IF NOT EXISTS reminders (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id   TEXT         NOT NULL,
  due_at     TIMESTAMPTZ  NOT NULL,
  sent_at    TIMESTAMPTZ  DEFAULT NULL,
  message    TEXT         DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders (due_at) WHERE sent_at IS NULL;

ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON reminders;
CREATE POLICY "service_role_all" ON reminders
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── 9. Advisory lock functions ──────────────────────────────────
CREATE OR REPLACE FUNCTION try_advisory_lock(key1 bigint, key2 bigint)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
AS $$ BEGIN RETURN pg_try_advisory_lock(key1, key2); END; $$;

CREATE OR REPLACE FUNCTION advisory_unlock(key1 bigint, key2 bigint)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
AS $$ BEGIN RETURN pg_advisory_unlock(key1, key2); END; $$;

COMMENT ON FUNCTION try_advisory_lock IS 'Thu lay advisory lock cho attendance, tra ve true neu thanh cong';
COMMENT ON FUNCTION advisory_unlock IS 'Giai phong advisory lock, tra ve true neu lock da duoc giai phong';

-- ── 10. Drop legacy table ───────────────────────────────────────
DROP TABLE IF EXISTS lich_co_dinh;
