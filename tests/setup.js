// tests/setup.js — Global test setup, chạy trước mọi test file
// Đảm bảo vi.mock('db.js') được apply trước bất kỳ module nào được import
import { vi } from 'vitest';

// Mock db.js toàn cục — Vitest sẽ dùng __mocks__/db.js tự động
vi.mock('../db.js');

// Reset tất cả mock sau mỗi test (không xóa implementation, chỉ reset call history)
// Nhưng không clearAllMocks toàn cục — mỗi test file tự clearAllMocks trong beforeEach
