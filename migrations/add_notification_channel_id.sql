-- Migration: thêm column notification_channel_id vào guild_configs
-- Chạy lần 1 trong Supabase Dashboard > SQL Editor

alter table guild_configs
  add column if not exists notification_channel_id text default null;

-- Reload PostgREST schema cache (bắt buộc sau khi thêm column)
-- Vào Supabase Dashboard > Settings > API > "Reload schema"
-- Hoặc chạy lệnh sau (cần superuser):
-- notify pgrst, 'reload schema';
