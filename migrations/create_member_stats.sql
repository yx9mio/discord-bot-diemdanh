-- migrations/create_member_stats.sql
-- Tạo bảng member_stats — thống kê cá nhân từng user trong từng guild
-- Hỗ trợ tính streak, tổng phiên tham gia, thống kê đầy đủ cho /rank, /toi, /thong_ke
--
-- Chú ý: Nếu bảng đã tồn tại (schema cũ có `last_session_id` uuid, không có các
-- columns late/excused/absent/attended_at) thì phần CREATE bị skip, chạy thêm file
-- alter_member_stats.sql để thêm các columns optional.

CREATE TABLE IF NOT EXISTS member_stats (
  id                BIGSERIAL PRIMARY KEY,
  guild_id          TEXT      NOT NULL,
  user_id           TEXT      NOT NULL,
  current_streak    INTEGER   NOT NULL DEFAULT 0,
  best_streak       INTEGER   NOT NULL DEFAULT 0,
  total_joined      INTEGER   NOT NULL DEFAULT 0,
  total_sessions    INTEGER   NOT NULL DEFAULT 0,
  total_late        INTEGER   NOT NULL DEFAULT 0,
  total_excused     INTEGER   NOT NULL DEFAULT 0,
  total_absent      INTEGER   NOT NULL DEFAULT 0,
  last_session_id   UUID      DEFAULT NULL,
  last_attended_at  TIMESTAMPTZ DEFAULT NULL,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (guild_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_member_stats_guild ON member_stats (guild_id);
CREATE INDEX IF NOT EXISTS idx_member_stats_guild_user ON member_stats (guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_member_stats_guild_total ON member_stats (guild_id, total_joined DESC);
CREATE INDEX IF NOT EXISTS idx_member_stats_guild_streak ON member_stats (guild_id, current_streak DESC);

-- Auto-update updated_at khi có UPDATE
CREATE OR REPLACE FUNCTION update_member_stats_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_member_stats_updated_at ON member_stats;
CREATE TRIGGER trg_member_stats_updated_at
  BEFORE UPDATE ON member_stats
  FOR EACH ROW EXECUTE FUNCTION update_member_stats_updated_at();

-- Enable RLS
ALTER TABLE member_stats ENABLE ROW LEVEL SECURITY;

-- Policy: service role được phép toàn quyền
CREATE POLICY "service_role_all" ON member_stats
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
