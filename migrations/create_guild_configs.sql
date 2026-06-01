-- migration: create_guild_configs
-- Tạo bảng guild_configs (chạy TRƯỚC add_guild_timezone.sql và add_notification_channel_id.sql)

CREATE TABLE IF NOT EXISTS guild_configs (
  guild_id                TEXT        PRIMARY KEY,
  timezone                TEXT        NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  notification_channel_id TEXT        DEFAULT NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at khi có UPDATE
CREATE OR REPLACE FUNCTION update_guild_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_guild_configs_updated_at ON guild_configs;
CREATE TRIGGER trg_guild_configs_updated_at
  BEFORE UPDATE ON guild_configs
  FOR EACH ROW EXECUTE FUNCTION update_guild_configs_updated_at();

-- Enable RLS (khuyến nghị)
ALTER TABLE guild_configs ENABLE ROW LEVEL SECURITY;

-- Policy: service role được phép toàn quyền (bot dùng service role key)
CREATE POLICY "service_role_all" ON guild_configs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
