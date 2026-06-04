// __mocks__/services/configService.js
// [B-4a] Manual mock cho configService — dùng khi vi.mock('../../services/configService')
'use strict';
const { vi } = require('vitest');

module.exports = {
  getGuildConfig:   vi.fn().mockResolvedValue(null),
  upsertGuildConfig: vi.fn().mockResolvedValue(null),
  setGuildConfig:   vi.fn().mockResolvedValue(null),
  getConfig:        vi.fn().mockResolvedValue(null),
};
