-- migrations/add_badges_table.sql
-- M-1: Tạo bảng badges để lưu mốc huy hiệu theo từng guild
-- Chạy: psql $DATABASE_URL -f migrations/add_badges_table.sql

CREATE TABLE IF NOT EXISTS badges (
  id         SERIAL PRIMARY KEY,
  guild_id   TEXT    NOT NULL,
  threshold  INTEGER NOT NULL,
  emoji      TEXT    NOT NULL DEFAULT '🏅',
  label      TEXT    NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (guild_id, threshold)
);

CREATE INDEX IF NOT EXISTS idx_badges_guild ON badges (guild_id);

-- Tạo bảng member_badges nếu chưa tồn tại
CREATE TABLE IF NOT EXISTS member_badges (
  id         SERIAL PRIMARY KEY,
  guild_id   TEXT    NOT NULL,
  user_id    TEXT    NOT NULL,
  threshold  INTEGER NOT NULL,
  earned_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (guild_id, user_id, threshold)
);

CREATE INDEX IF NOT EXISTS idx_member_badges_guild_user ON member_badges (guild_id, user_id);
