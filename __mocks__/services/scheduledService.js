// __mocks__/services/scheduledService.js
// [B-4a] Manual mock cho scheduledService — dùng khi vi.mock('../../services/scheduledService')
'use strict';
const { vi } = require('vitest');

module.exports = {
  getScheduledSessions:    vi.fn().mockResolvedValue([]),
  getScheduledSessionById: vi.fn().mockResolvedValue(null),
  createScheduledSession:  vi.fn().mockResolvedValue(null),
  updateScheduledSession:  vi.fn().mockResolvedValue(null),
  deleteScheduledSession:  vi.fn().mockResolvedValue(null),
  skipScheduledSession:    vi.fn().mockResolvedValue(null),
  getLichCoDinh:           vi.fn().mockResolvedValue([]),
  getLichCoDinhById:       vi.fn().mockResolvedValue(null),
  createLichCoDinh:        vi.fn().mockResolvedValue(null),
  updateLichCoDinh:        vi.fn().mockResolvedValue(null),
  deleteLichCoDinh:        vi.fn().mockResolvedValue(null),
  themLichCoDinh:          vi.fn().mockResolvedValue(null),
  suaLichCoDinh:           vi.fn().mockResolvedValue(null),
  xoaLichCoDinh:           vi.fn().mockResolvedValue(null),
};
