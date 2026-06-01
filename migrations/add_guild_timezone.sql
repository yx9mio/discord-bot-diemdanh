-- migration: add_guild_timezone
-- Thêm cột timezone vào guild_configs
-- Default: 'Asia/Ho_Chi_Minh'
ALTER TABLE guild_configs
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh';
