-- BUG-4 FIX: attendances composite unique constraint
-- Chạy 1 lần trên Supabase SQL Editor hoặc qua supabase db push

-- Xóa các unique constraint sai (nếu tồn tại)
ALTER TABLE attendances DROP CONSTRAINT IF EXISTS attendances_session_id_key;
ALTER TABLE attendances DROP CONSTRAINT IF EXISTS attendances_user_id_key;

-- Thêm composite unique constraint đúng
-- Đây là constraint mà upsertAttendance dùng: onConflict: 'session_id,user_id'
ALTER TABLE attendances
  ADD CONSTRAINT IF NOT EXISTS attendances_session_user_unique
  UNIQUE (session_id, user_id);
