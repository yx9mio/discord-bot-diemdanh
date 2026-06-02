// tests/smoke/helpNav.test.js
// Test: /help render với 2 trang (user/admin), nút chuyển trang, ephemeral.

import { describe, it, expect, beforeAll } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

function mockModule(modulePath, exports) {
  const fullPath = require.resolve(modulePath);
  require.cache[fullPath] = { exports, loaded: true, id: fullPath, filename: fullPath };
}

beforeAll(() => {
  mockModule('../../db.js', {
    getActiveSession: async () => null,
    getGuildConfig:   async () => ({ phai_role_ids: [], log_channel_id: null }),
  });
  mockModule('../../utils/embeds.js', {
    FOOTER_DEFAULT: 'TEST FOOTER',
    replyErr: m => ({ content: m, ephemeral: true }),
  });
});

const { HelpCommand, CUSTOM_ID } = require('../../src/commands/general/help.js');

describe('HelpCommand (smoke)', () => {
  it('export đúng tên + customIds', () => {
    expect(CUSTOM_ID.USER_PAGE).toBe('help:page:user');
    expect(CUSTOM_ID.ADMIN_PAGE).toBe('help:page:admin');
    expect(typeof HelpCommand.render).toBe('function');
  });

  it('render(user) gọi target.update với 1 embed + 1 row', () => {
    const calls = { count: 0, args: null };
    const target = { update: async (payload) => { calls.count++; calls.args = payload; return payload; } };
    return HelpCommand.render('user', target).then(() => {
      expect(calls.count).toBe(1);
      expect(calls.args.embeds).toHaveLength(1);
      expect(calls.args.components).toHaveLength(1);
      const row = calls.args.components[0];
      expect(row.toJSON().type).toBe(1);
      const buttons = row.toJSON().components;
      expect(buttons).toHaveLength(2);
      const labels = buttons.map(b => b.label);
      expect(labels[0]).toMatch(/mọi người/i);
      expect(labels[1]).toMatch(/admin/i);
    });
  });

  it('render(admin) embed có color khác + footer có "lệnh"', () => {
    const target = { update: async (p) => p };
    return HelpCommand.render('admin', target).then(payload => {
      const embed = payload.embeds[0].toJSON();
      expect(embed.title).toMatch(/admin/i);
      expect(embed.description).toMatch(/quản lý server/i);
      expect(embed.footer.text).toMatch(/lệnh/);
    });
  });

  it('render(user) hiển thị quickstart cho admin', () => {
    const target = { update: async (p) => p };
    return HelpCommand.render('user', target).then(payload => {
      const embed = payload.embeds[0].toJSON();
      expect(embed.title).toMatch(/mọi người/i);
      const flat = embed.fields.map(f => f.value).join('\n');
      expect(flat).toMatch(/diemdanh/);
    });
  });

  it('active button bị disabled', () => {
    const target = { update: async (p) => p };
    return HelpCommand.render('admin', target).then(payload => {
      const buttons = payload.components[0].toJSON().components;
      const adminBtn = buttons.find(b => b.label.match(/admin/i));
      const userBtn  = buttons.find(b => b.label.match(/mọi người/i));
      expect(adminBtn.disabled).toBe(true);
      expect(userBtn.disabled).toBe(false);
    });
  });
});
