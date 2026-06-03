// tests/unit/legacyCommandRedirect.test.js
// Test: Q10=a — listener redirect slash command cũ → ephemeral "đã chuyển vào /setup".

import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const mockReply = vi.fn();
const mockIsChat = vi.fn();

const fakeInteraction = () => ({
  isChatInputCommand: mockIsChat,
  commandName:        'caidat',
  replied:            false,
  deferred:           false,
  reply:              mockReply,
});

vi.mock('@sapphire/framework', () => ({
  Listener: class {
    constructor(_ctx, opts) { this.event = opts.event; this.name = opts.name; }
  },
  Events: { InteractionCreate: 'interactionCreate' },
}));

describe('legacyCommandRedirect listener', () => {
  it('LEGACY_COMMANDS chứa các lệnh cũ đã xoá ở Commit 6', () => {
    const { LEGACY_COMMANDS } = require('../../listeners/legacyCommandRedirect.js');
    expect(LEGACY_COMMANDS.has('caidat')).toBe(true);
    expect(LEGACY_COMMANDS.has('lichcodinh')).toBe(true);
    expect(LEGACY_COMMANDS.has('nhacnho')).toBe(true);
    expect(LEGACY_COMMANDS.has('them')).toBe(true);
    expect(LEGACY_COMMANDS.has('xoa')).toBe(true);
    expect(LEGACY_COMMANDS.has('huy')).toBe(true);
    expect(LEGACY_COMMANDS.has('broadcast')).toBe(true);
    expect(LEGACY_COMMANDS.has('thongke_server')).toBe(true);
    expect(LEGACY_COMMANDS.has('xuat')).toBe(true);
    expect(LEGACY_COMMANDS.has('toi')).toBe(true);
    expect(LEGACY_COMMANDS.has('rank')).toBe(true);
    expect(LEGACY_COMMANDS.has('lichsu')).toBe(true);
  });

  it('KHÔNG chứa 6 lệnh mới', () => {
    const { LEGACY_COMMANDS } = require('../../listeners/legacyCommandRedirect.js');
    expect(LEGACY_COMMANDS.has('batdau')).toBe(false);
    expect(LEGACY_COMMANDS.has('ketthuc')).toBe(false);
    expect(LEGACY_COMMANDS.has('status')).toBe(false);
    expect(LEGACY_COMMANDS.has('diemdanh')).toBe(false);
    expect(LEGACY_COMMANDS.has('help')).toBe(false);
    expect(LEGACY_COMMANDS.has('setup')).toBe(false);
  });

  it('reply ephemeral khi user dùng lệnh cũ', async () => {
    mockReply.mockClear();
    mockIsChat.mockReturnValue(true);
    const { LegacyCommandRedirectListener } = require('../../listeners/legacyCommandRedirect.js');
    const listener = new LegacyCommandRedirectListener({});
    const i = fakeInteraction();
    i.commandName = 'caidat';
    await listener.run(i);
    expect(mockReply).toHaveBeenCalledTimes(1);
    const arg = mockReply.mock.calls[0][0];
    expect(arg.flags).toBe(64);
    expect(arg.content).toMatch(/\/setup/);
    expect(arg.content).toMatch(/caidat/);
  });

  it('KHÔNG reply khi interaction không phải chat input command', async () => {
    mockReply.mockClear();
    mockIsChat.mockReturnValue(false);
    const { LegacyCommandRedirectListener } = require('../../listeners/legacyCommandRedirect.js');
    const listener = new LegacyCommandRedirectListener({});
    await listener.run(fakeInteraction());
    expect(mockReply).not.toHaveBeenCalled();
  });

  it('KHÔNG reply khi command name mới (không trong legacy set)', async () => {
    mockReply.mockClear();
    mockIsChat.mockReturnValue(true);
    const { LegacyCommandRedirectListener } = require('../../listeners/legacyCommandRedirect.js');
    const listener = new LegacyCommandRedirectListener({});
    const i = fakeInteraction();
    i.commandName = 'batdau';
    await listener.run(i);
    expect(mockReply).not.toHaveBeenCalled();
  });

  it('KHÔNG reply khi interaction đã reply/defer trước', async () => {
    mockReply.mockClear();
    mockIsChat.mockReturnValue(true);
    const { LegacyCommandRedirectListener } = require('../../listeners/legacyCommandRedirect.js');
    const listener = new LegacyCommandRedirectListener({});
    const i = fakeInteraction();
    i.replied = true;
    await listener.run(i);
    expect(mockReply).not.toHaveBeenCalled();
  });

  it('KHÔNG throw khi reply reject (double-reply edge case)', async () => {
    mockReply.mockRejectedValueOnce(new Error('Already replied'));
    mockIsChat.mockReturnValue(true);
    const { LegacyCommandRedirectListener } = require('../../listeners/legacyCommandRedirect.js');
    const listener = new LegacyCommandRedirectListener({});
    const i = fakeInteraction();
    i.commandName = 'huy';
    await expect(listener.run(i)).resolves.toBeUndefined();
  });
});
