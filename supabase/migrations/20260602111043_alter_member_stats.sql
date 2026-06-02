-- migrations/alter_member_stats.sql
-- Thêm columns optional cho member_stats khi bảng đã tồn tại từ migration cũ
-- (schema cũ có `last_session_id` uuid nhưng KHÔNG có late/excused/absent/attended_at)
-- Idempotent: ADD COLUMN IF NOT EXISTS — an toàn chạy nhiều lần

ALTER TABLE member_stats ADD COLUMN IF NOT EXISTS total_late        INTEGER NOT NULL DEFAULT 0;
ALTER TABLE member_stats ADD COLUMN IF NOT EXISTS total_excused     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE member_stats ADD COLUMN IF NOT EXISTS total_absent      INTEGER NOT NULL DEFAULT 0;
ALTER TABLE member_stats ADD COLUMN IF NOT EXISTS last_attended_at  TIMESTAMPTZ;
