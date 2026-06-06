// tests/unit/rows.test.js
// [Phase-E] Unit tests for utils/_views/rows.js
import { describe, it, expect } from 'vitest';
import {
  buildConfirmRow,
  buildAttendanceRow,
  buildNavRow,
} from '../../utils/_views/rows.js';

describe('buildConfirmRow', () => {
  it('trả về ActionRowBuilder có 2 button', () => {
    const row = buildConfirmRow('yes_id', 'no_id');
    const json = row.toJSON();
    expect(json.components).toHaveLength(2);
  });
  it('button đầu tiên customId = yes_id', () => {
    const row = buildConfirmRow('yes_id', 'no_id');
    expect(row.toJSON().components[0].custom_id).toBe('yes_id');
  });
});

describe('buildAttendanceRow', () => {
  it('trả về ActionRowBuilder', () => {
    const row = buildAttendanceRow('sess-001');
    expect(row.toJSON().components.length).toBeGreaterThan(0);
  });
});

describe('buildNavRow', () => {
  it('tạo được với 1 button', () => {
    const row = buildNavRow([{ customId: 'nav_home', label: 'Home', emoji: '🏠' }]);
    expect(row.toJSON().components).toHaveLength(1);
  });
  it('không throw khi buttons rỗng', () => {
    expect(() => buildNavRow([])).not.toThrow();
  });
});
