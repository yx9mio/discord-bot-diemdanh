// tests/setup.js — Global test setup, chạy trước mọi test file
// vi.mock toàn cục đã bị xóa để tránh conflict với inline vi.mock factory
// trong từng test file (session.test.js, badge.test.js, v.v.)
// Mỗi test file tự mock db.js với factory riêng → mock đúng reference.
