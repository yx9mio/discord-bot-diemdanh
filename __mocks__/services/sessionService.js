// __mocks__/services/sessionService.js
// [B-4a] Manual mock cho sessionService — dùng khi vi.mock('../../services/sessionService')
'use strict';
const { vi } = require('vitest');

module.exports = {
  createSession:         vi.fn().mockResolvedValue(null),
  getActiveSession:      vi.fn().mockResolvedValue(null),
  getSessionById:        vi.fn().mockResolvedValue(null),
  getSessionByMessageId: vi.fn().mockResolvedValue(null),
  closeSession:          vi.fn().mockResolvedValue(null),
  cancelSession:         vi.fn().mockResolvedValue(null),
  updateSessionMessage:  vi.fn().mockResolvedValue(null),
  updateSessionName:     vi.fn().mockResolvedValue(null),
  updateSessionEligible: vi.fn().mockResolvedValue(null),
  getRecentSessions:     vi.fn().mockResolvedValue([]),
  getAllSessions:         vi.fn().mockResolvedValue([]),
  getSessionHistory:     vi.fn().mockResolvedValue([]),
  getSessionByIdRaw:     vi.fn().mockResolvedValue(null),
};
