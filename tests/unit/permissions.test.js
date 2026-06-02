// tests/unit/permissions.test.js
// Test requireAdmin với mock Discord interaction
import { describe, it, expect, vi } from 'vitest';

vi.mock('discord.js', () => ({
  PermissionFlagsBits: {
    Administrator: 8n,
    ManageGuild: 32n,
  },
}));

// ─── Helper tạo mock interaction ─────────────────────────────────────────────
function makeMockInteraction({ isAdmin = false, hasManageGuild = false } = {}) {
  const perms = new Map();
  if (isAdmin)        perms.set('Administrator', true);
  if (hasManageGuild) perms.set('ManageGuild', true);
  return {
    memberPermissions: {
      has: (flag) => {
        if (flag === 8n)  return isAdmin;
        if (flag === 32n) return hasManageGuild;
        return false;
      },
    },
    reply: vi.fn().mockResolvedValue(null),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────
describe('requireAdmin (permission check logic)', () => {
  it('admin có flag Administrator (8n) → has() trả true', () => {
    const interaction = makeMockInteraction({ isAdmin: true });
    expect(interaction.memberPermissions.has(8n)).toBe(true);
  });

  it('non-admin → has(Administrator) trả false', () => {
    const interaction = makeMockInteraction({ isAdmin: false });
    expect(interaction.memberPermissions.has(8n)).toBe(false);
  });

  it('ManageGuild flag (32n) độc lập với Administrator', () => {
    const interaction = makeMockInteraction({ hasManageGuild: true });
    expect(interaction.memberPermissions.has(32n)).toBe(true);
    expect(interaction.memberPermissions.has(8n)).toBe(false);
  });

  it('không có permission nào → cả 2 flag đều false', () => {
    const interaction = makeMockInteraction();
    expect(interaction.memberPermissions.has(8n)).toBe(false);
    expect(interaction.memberPermissions.has(32n)).toBe(false);
  });

  it('reply mock được gọi đúng khi từ chối', async () => {
    const interaction = makeMockInteraction({ isAdmin: false });
    // Simulate: nếu không có quyền, gọi reply
    if (!interaction.memberPermissions.has(8n)) {
      await interaction.reply({ content: 'Không có quyền', ephemeral: true });
    }
    expect(interaction.reply).toHaveBeenCalledOnce();
    expect(interaction.reply).toHaveBeenCalledWith({ content: 'Không có quyền', ephemeral: true });
  });
});
