-- migrations/create_members.sql
-- Tạo bảng members — danh sách thành viên được quản lý trong guild
-- Mỗi guild có danh sách thành viên riêng, có thể có phòng ban (phong_ban)

CREATE TABLE IF NOT EXISTS members (
  id          BIGSERIAL PRIMARY KEY,
  guild_id    TEXT      NOT NULL,
  user_id     TEXT      NOT NULL,
  username    TEXT      DEFAULT NULL,
  phong_ban   TEXT      DEFAULT NULL,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (guild_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_members_guild ON members (guild_id);
CREATE INDEX IF NOT EXISTS idx_members_guild_user ON members (guild_id, user_id);

-- Auto-update updated_at khi có UPDATE
CREATE OR REPLACE FUNCTION update_members_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_members_updated_at ON members;
CREATE TRIGGER trg_members_updated_at
  BEFORE UPDATE ON members
  FOR EACH ROW EXECUTE FUNCTION update_members_updated_at();

-- Enable RLS
ALTER TABLE members ENABLE ROW LEVEL SECURITY;

-- Policy: service role được phép toàn quyền
CREATE POLICY "service_role_all" ON members
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
