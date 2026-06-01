// tests/unit/permissions.test.js
// Test requireAdmin với mock Discord interaction
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PermissionFlagsBits } from 'discord.js';

// Mock discord.js và logger
vi.mock('discord.js', () => ({
  PermissionFlagsBits: {
    Administrator: 8n,
    ManageGuild: 32n,
  },
}));
vi.mock('../utils/embeds.js', () => ({
  replyErr: (msg) => ({ content: msg }),
  replyErrEdit: (msg) => ({ content: msg }),
}));

// Import sau khi mock
const { requireAdmin } = await import('../utils/permissions.js');

function makeInteraction(overrides = {}) {
  return {
    user: { id: 'u1' },
    member: {
      permissions: {
        has: vi.fn((flag) => {
          const perms = overrides.perms ?? [];
          return perms.includes(flag);
        }),
      },
    },
    reply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('requireAdmin', () => {
  it('bot owner bypass → ok=true, không reply', async () => {
    process.env.BOT_OWNER_ID = 'owner123';
    const interaction = makeInteraction({ user: { id: 'owner123' } });
    const result = await requireAdmin(interaction);
    expect(result.ok).toBe(true);
    expect(interaction.reply).not.toHaveBeenCalled();
    delete process.env.BOT_OWNER_ID;
  });

  it('member = null → ok=false, reply lỗi', async () => {
    const interaction = makeInteraction({ member: null });
    const result = await requireAdmin(interaction, { context: 'test' });
    expect(result.ok).toBe(false);
    expect(interaction.reply).toHaveBeenCalled();
  });

  it('có quyền Administrator → ok=true', async () => {
    const interaction = makeInteraction({ perms: [8n] });
    const result = await requireAdmin(interaction);
    expect(result.ok).toBe(true);
  });

  it('có quyền ManageGuild → ok=true', async () => {
    const interaction = makeInteraction({ perms: [32n] });
    const result = await requireAdmin(interaction);
    expect(result.ok).toBe(true);
  });

  it('không có quyền → ok=false, reply lỗi', async () => {
    const interaction = makeInteraction({ perms: [] });
    const result = await requireAdmin(interaction, { context: 'kiểm tra' });
    expect(result.ok).toBe(false);
    expect(interaction.reply).toHaveBeenCalled();
  });

  it('deferred=true + không có quyền → editReply thay reply', async () => {
    const interaction = makeInteraction({ perms: [] });
    const result = await requireAdmin(interaction, { deferred: true });
    expect(result.ok).toBe(false);
    expect(interaction.editReply).toHaveBeenCalled();
    expect(interaction.reply).not.toHaveBeenCalled();
  });

  it('deferred=true + có quyền → ok=true, không call gì', async () => {
    const interaction = makeInteraction({ perms: [8n] });
    const result = await requireAdmin(interaction, { deferred: true });
    expect(result.ok).toBe(true);
    expect(interaction.editReply).not.toHaveBeenCalled();
  });
});
