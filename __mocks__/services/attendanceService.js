// __mocks__/services/attendanceService.js
// [B-4a] Manual mock cho attendanceService — dùng khi vi.mock('../../services/attendanceService')
'use strict';
const { vi } = require('vitest');

module.exports = {
  upsertAttendance:       vi.fn().mockResolvedValue(null),
  upsertAttendanceNoTime: vi.fn().mockResolvedValue(null),
  getAttendances:         vi.fn().mockResolvedValue([]),
  getAttendancesByUser:   vi.fn().mockResolvedValue([]),
  getAttendanceStats:     vi.fn().mockResolvedValue([]),
  getAllAttendances:       vi.fn().mockResolvedValue([]),
};
