-- migration: drop_lich_co_dinh
-- Bảng lich_co_dinh đã được thay thế hoàn toàn bởi scheduled_sessions.
-- Chạy migration này sau khi đã xác nhận bot hoạt động ổn định với scheduled_sessions.
DROP TABLE IF EXISTS lich_co_dinh;
