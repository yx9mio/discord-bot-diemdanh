// tests/unit/summaryView.test.js
// [Phase-E] Unit tests for utils/_views/summaryView.js
import { describe, it, expect } from 'vitest';
import { buildSummaryEmbed } from '../../utils/_views/summaryView.js';

const makeSession = (overrides = {}) => ({
  id: 'sess-001',
  guild_id: 'guild-001',
  name: 'Buổi tập 1',
  start_time: new Date('2026-06-01T10:00:00Z').toISOString(),
  end_time:   new Date('2026-06-01T12:00:00Z').toISOString(),
  status: 'closed',
  eligible_member_ids: [],
  ...overrides,
});

const makeAttended = (list = []) => list.map((status, i) => ({
  user_id: `user-${i}`,
  status,
  display_name: `Member ${i}`,
}));

describe('buildSummaryEmbed', () => {
  it('trả về EmbedBuilder (có .setColor)', () => {
    const embed = buildSummaryEmbed(makeSession(), [], null, []);
    expect(typeof embed.setColor).toBe('function');
  });

  it('hoạt động khi attended rỗng', () => {
    const embed = buildSummaryEmbed(makeSession(), [], null, []);
    const data = embed.toJSON();
    expect(data.type).toBe('rich');
  });

  it('tính đúng % tham gia', () => {
    const attended = makeAttended(['tham_gia', 'tham_gia', 'khong_tham_gia', 'tre']);
    const embed = buildSummaryEmbed(makeSession(), attended, null, []);
    const json = embed.toJSON();
    // 3/4 = 75% — kiểm tra description hoặc fields có chứa '75'
    const text = JSON.stringify(json);
    expect(text).toContain('75');
  });

  it('xử lý attended = null gracefully', () => {
    expect(() => buildSummaryEmbed(makeSession(), null, null, [])).not.toThrow();
  });

  it('xử lý session.name = undefined gracefully', () => {
    expect(() => buildSummaryEmbed(makeSession({ name: undefined }), [], null, [])).not.toThrow();
  });
});
