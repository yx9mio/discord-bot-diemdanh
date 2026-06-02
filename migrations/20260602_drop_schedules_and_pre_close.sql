-- migrations/20260602_drop_schedules_and_pre_close.sql
-- Commit 2: thống nhất lịch cố định dùng bảng scheduled_sessions
--
-- 1. Thêm cột pre_close_minutes (số phút đóng phiên điểm danh TRƯỚC giờ mở)
--    Default 30 phù hợp case "Giải Đấu Bang Hội" (mở 20h, đóng DD 19:30).
-- 2. Drop cột `schedules` JSON cũ trong guild_configs (đã được thay bằng table)
--
-- Chạy: psql $DATABASE_URL -f migrations/20260602_drop_schedules_and_pre_close.sql
-- Idempotent: ADD COLUMN IF NOT EXISTS, DROP COLUMN IF EXISTS

-- 1. pre_close_minutes
ALTER TABLE scheduled_sessions
  ADD COLUMN IF NOT EXISTS pre_close_minutes INTEGER NOT NULL DEFAULT 30
    CHECK (pre_close_minutes >= 0 AND pre_close_minutes <= 180);

COMMENT ON COLUMN scheduled_sessions.pre_close_minutes IS
  'Số phút đóng phiên điểm danh TRƯỚC giờ mở. VD: phiên 20:00, pre_close=30 → đóng DD lúc 19:30. Default 30.';

-- 2. Drop cột schedules JSON cũ (đã chuyển sang table)
-- Q8=b: không có dữ liệu cũ cần migrate. Drop thẳng.
ALTER TABLE guild_configs
  DROP COLUMN IF EXISTS schedules;

-- 3. Drop auto_schedule_enabled cũ (đã được thay bằng cột is_active trong table)
ALTER TABLE guild_configs
  DROP COLUMN IF EXISTS auto_schedule_enabled;
