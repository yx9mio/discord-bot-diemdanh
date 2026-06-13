CREATE TABLE IF NOT EXISTS guild_emojis (
  guild_id TEXT NOT NULL,
  emoji_id TEXT NOT NULL,
  emoji_name TEXT NOT NULL,
  animated BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (guild_id, emoji_id)
);

CREATE INDEX IF NOT EXISTS idx_guild_emojis_guild_id ON guild_emojis (guild_id);
CREATE INDEX IF NOT EXISTS idx_guild_emojis_name ON guild_emojis (guild_id, emoji_name);

ALTER TABLE guild_emojis ENABLE ROW LEVEL SECURITY;
-- Service role (backend) có toàn quyền, anon chỉ đọc
DROP POLICY IF EXISTS "Service role full access" ON guild_emojis;
CREATE POLICY "Service role full access" ON guild_emojis
  FOR ALL USING (true) WITH CHECK (true);
