import { describe, it, expect, vi } from 'vitest';

// Mock discord.js trước khi import embeds
vi.mock('discord.js', () => ({
  EmbedBuilder: class {
    setColor() { return this; }
    setTitle(t) { this._title = t; return this; }
    setDescription(d) { this._desc = d; return this; }
    addFields(f) { this._fields = f; return this; }
    setFooter() { return this; }
    setTimestamp() { return this; }
    data = {};
  },
  ActionRowBuilder: class {
    addComponents() { return this; }
    toJSON() { return {}; }
  },
  ButtonBuilder: class {
    setCustomId() { return this; }
    setLabel() { return this; }
    setStyle() { return this; }
    setDisabled() { return this; }
  },
  ButtonStyle: { Primary: 1, Secondary: 2, Success: 3, Danger: 4 },
  MessageFlags: { Ephemeral: 64 },
}));

// Mock db.js
vi.mock('../db.js', () => ({
  getMemberStatsMulti: vi.fn().mockResolvedValue([]),
  getBadgeDefinitions: vi.fn().mockResolvedValue([]),
}));

describe('buildSummaryEmbed — eligible_member_ids null safety', () => {
  it('không crash khi eligible_member_ids = null', async () => {
    const { buildSummaryEmbed } = await import('../utils/embeds.js');
    const session = {
      id: 'sess-1',
      session_name: 'Test',
      guild_id: 'g1',
      eligible_member_ids: null, // edge case chính
      created_at: new Date().toISOString(),
    };
    const attended = [
      { user_id: 'u1', status: 'tham_gia', username: 'Alice' },
      { user_id: 'u2', status: 'khong_tham_gia', username: 'Bob' },
    ];
    const guild = { name: 'Test Guild', memberCount: 10 };
    // Không throw là pass
    expect(() => buildSummaryEmbed(session, attended, guild)).not.toThrow();
  });

  it('không crash khi eligible_member_ids = []', async () => {
    const { buildSummaryEmbed } = await import('../utils/embeds.js');
    const session = {
      id: 'sess-2',
      session_name: 'Test 2',
      guild_id: 'g1',
      eligible_member_ids: [],
      created_at: new Date().toISOString(),
    };
    expect(() => buildSummaryEmbed(session, [], {})).not.toThrow();
  });
});
