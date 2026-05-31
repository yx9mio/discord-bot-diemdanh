// tests/embeds.test.js — Embed & component structure tests
// Chạy: node --test tests/embeds.test.js
// Không cần bot token hay kết nối Discord — test thuần JS structure
'use strict';

const assert = require('node:assert/strict');
const { describe, it, before } = require('node:test');

// Mock discord.js nhẹ — chỉ cần EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const {
  embedSuccess,
  embedDanger,
  embedWarning,
  embedInfo,
  embedGray,
  replyOk,
  replyErr,
  replyWarn,
  replyInfo,
  replyOkEdit,
  replyErrEdit,
  replyLoading,
  replyConfirm,
  buildAttendanceButtons,
  buildSummaryEmbed,
  COLORS,
  ICONS,
} = require('../utils/embeds.js');

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const MOCK_SESSION = {
  session_name:       'Luyện Tập Tuần 1',
  role_name:          'Môn Sinh',
  allowed_role_id:    null,
  created_at:         '2026-05-31T14:00:00.000Z',
  started_at:         '2026-05-31T14:00:00.000Z',
  ended_at:           '2026-05-31T15:30:00.000Z',
  auto_close_at:      null,
  eligible_member_ids: ['u1', 'u2', 'u3', 'u4', 'u5'],
};

const MOCK_ATTENDED = [
  { user_id: 'u1', username: 'Alice', status: 'tham_gia' },
  { user_id: 'u2', username: 'Bob',   status: 'tham_gia' },
  { user_id: 'u3', username: 'Carol', status: 'tre' },
  { user_id: 'u4', username: 'Dave',  status: 'khong_tham_gia' },
];

// ─── Helper: lấy raw data từ EmbedBuilder ─────────────────────────────────────
const raw = (embed) => embed.toJSON();

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('COLORS constants', () => {
  it('có đủ 7 màu cần thiết', () => {
    const required = ['PRIMARY', 'SUCCESS', 'DANGER', 'WARNING', 'INACTIVE', 'GOLD', 'INFO'];
    for (const key of required) {
      assert.ok(typeof COLORS[key] === 'number', `COLORS.${key} phải là số`);
    }
  });

  it('SUCCESS và DANGER khác nhau', () => {
    assert.notEqual(COLORS.SUCCESS, COLORS.DANGER);
  });
});

describe('ICONS constants', () => {
  it('có đủ các icon quan trọng', () => {
    const required = ['SESSION_OPEN', 'SESSION_CLOSED', 'ATTEND_YES', 'ATTEND_LATE', 'ATTEND_NO', 'ATTEND_ABSENT', 'CLOCK', 'STATS'];
    for (const key of required) {
      assert.ok(typeof ICONS[key] === 'string' && ICONS[key].length > 0, `ICONS.${key} phải là string không rỗng`);
    }
  });
});

describe('Semantic embed factories', () => {
  it('embedSuccess — color đúng, title không rỗng', () => {
    const e = raw(embedSuccess('Thành công', 'Nội dung'));
    assert.equal(e.color, COLORS.SUCCESS);
    assert.ok(e.title?.includes('Thành công'));
    assert.equal(e.description, 'Nội dung');
  });

  it('embedDanger — color đúng', () => {
    const e = raw(embedDanger('Lỗi'));
    assert.equal(e.color, COLORS.DANGER);
  });

  it('embedWarning — color đúng', () => {
    const e = raw(embedWarning('Chú ý'));
    assert.equal(e.color, COLORS.WARNING);
  });

  it('embedInfo — color đúng', () => {
    const e = raw(embedInfo('Thông tin'));
    assert.equal(e.color, COLORS.INFO);
  });

  it('embedGray — color đúng', () => {
    const e = raw(embedGray('Không hoạt động'));
    assert.equal(e.color, COLORS.INACTIVE);
  });

  it('description = null nếu không truyền', () => {
    const e = raw(embedSuccess('title'));
    assert.equal(e.description, null);
  });
});

describe('Reply helpers (ephemeral)', () => {
  it('replyOk — có embeds, ephemeral=true', () => {
    const r = replyOk('Xong rồi');
    assert.ok(Array.isArray(r.embeds) && r.embeds.length > 0);
    assert.equal(r.ephemeral, true);
  });

  it('replyErr — có embeds, ephemeral=true', () => {
    const r = replyErr('Có lỗi');
    assert.ok(Array.isArray(r.embeds) && r.embeds.length > 0);
    assert.equal(r.ephemeral, true);
  });

  it('replyWarn — có embeds, ephemeral=true', () => {
    const r = replyWarn('Chú ý');
    assert.equal(r.ephemeral, true);
  });

  it('replyInfo — có embeds, ephemeral=true', () => {
    const r = replyInfo('Thông tin');
    assert.equal(r.ephemeral, true);
  });
});

describe('Reply edit helpers (sau deferReply)', () => {
  it('replyOkEdit — components = [], không có ephemeral', () => {
    const r = replyOkEdit('Xong');
    assert.deepEqual(r.components, []);
    assert.equal(r.ephemeral, undefined);
  });

  it('replyErrEdit — components = []', () => {
    const r = replyErrEdit('Lỗi');
    assert.deepEqual(r.components, []);
  });
});

describe('replyLoading', () => {
  it('default message khi không truyền tham số', () => {
    const r = replyLoading();
    const e = r.embeds[0].toJSON();
    assert.ok(e.description?.includes('Đang xử lý'));
    assert.equal(e.color, COLORS.INACTIVE);
  });

  it('custom message', () => {
    const r = replyLoading('Đang tải dữ liệu...');
    const e = r.embeds[0].toJSON();
    assert.ok(e.description?.includes('Đang tải dữ liệu'));
  });

  it('components = []', () => {
    assert.deepEqual(replyLoading().components, []);
  });
});

describe('replyConfirm', () => {
  it('có embed + 2 buttons', () => {
    const r = replyConfirm('Xóa session?', 'confirm:delete_session', 'confirm:cancel');
    assert.equal(r.embeds.length, 1);
    assert.equal(r.components.length, 1);
    const buttons = r.components[0].components;
    assert.equal(buttons.length, 2);
  });

  it('nút đầu tiên là customIdConfirm', () => {
    const r = replyConfirm('Xóa?', 'confirm:abc');
    const btn = r.components[0].components[0].toJSON();
    assert.equal(btn.custom_id, 'confirm:abc');
  });

  it('nút hủy mặc định là confirm:cancel', () => {
    const r = replyConfirm('Xóa?', 'confirm:xyz');
    const btn = r.components[0].components[1].toJSON();
    assert.equal(btn.custom_id, 'confirm:cancel');
  });

  it('ephemeral = true', () => {
    assert.equal(replyConfirm('?', 'c:a').ephemeral, true);
  });
});

describe('buildAttendanceButtons', () => {
  it('trả về 1 ActionRow với 4 buttons', () => {
    const row = buildAttendanceButtons();
    const json = row.toJSON();
    assert.equal(json.components.length, 4);
  });

  it('disabled=false — tất cả 3 nút đầu enabled (attend_view luôn enabled)', () => {
    const row = buildAttendanceButtons(false);
    const btns = row.toJSON().components;
    assert.equal(btns[0].disabled, false);
    assert.equal(btns[1].disabled, false);
    assert.equal(btns[2].disabled, false);
    assert.equal(btns[3].disabled, false);
  });

  it('disabled=true — 3 nút đầu bị disabled, attend_view không bị', () => {
    const row = buildAttendanceButtons(true);
    const btns = row.toJSON().components;
    assert.equal(btns[0].disabled, true);
    assert.equal(btns[1].disabled, true);
    assert.equal(btns[2].disabled, true);
    assert.equal(btns[3].disabled, false);
  });

  it('customIds đúng', () => {
    const row = buildAttendanceButtons();
    const ids = row.toJSON().components.map(b => b.custom_id);
    assert.deepEqual(ids, ['attend_yes', 'attend_late', 'attend_no', 'attend_view']);
  });
});

describe('buildSummaryEmbed', () => {
  it('trả về EmbedBuilder', () => {
    const embed = buildSummaryEmbed(MOCK_SESSION, MOCK_ATTENDED);
    assert.ok(embed instanceof EmbedBuilder);
  });

  it('title chứa tên session', () => {
    const e = raw(buildSummaryEmbed(MOCK_SESSION, MOCK_ATTENDED));
    assert.ok(e.title?.includes(MOCK_SESSION.session_name));
  });

  it('color theo % hiện diện (3/5 = 60% → WARNING)', () => {
    const e = raw(buildSummaryEmbed(MOCK_SESSION, MOCK_ATTENDED));
    // 2 tham_gia + 1 tre = 3 present, 5 eligible → 60% → WARNING
    assert.equal(e.color, COLORS.WARNING);
  });

  it('color SUCCESS khi tỷ lệ cao (≥80%)', () => {
    const highAttended = [
      { user_id: 'u1', username: 'Alice', status: 'tham_gia' },
      { user_id: 'u2', username: 'Bob',   status: 'tham_gia' },
      { user_id: 'u3', username: 'Carol', status: 'tham_gia' },
      { user_id: 'u4', username: 'Dave',  status: 'tham_gia' },
      { user_id: 'u5', username: 'Eve',   status: 'tham_gia' },
    ];
    const e = raw(buildSummaryEmbed(MOCK_SESSION, highAttended));
    assert.equal(e.color, COLORS.SUCCESS);
  });

  it('color DANGER khi tỷ lệ thấp (<50%)', () => {
    const lowAttended = [
      { user_id: 'u1', username: 'Alice', status: 'tham_gia' },
    ];
    const e = raw(buildSummaryEmbed(MOCK_SESSION, lowAttended));
    assert.equal(e.color, COLORS.DANGER);
  });

  it('description chứa % hiện diện', () => {
    const e = raw(buildSummaryEmbed(MOCK_SESSION, MOCK_ATTENDED));
    assert.ok(e.description?.includes('60%'));
  });

  it('có fields cho Tham Gia, Vắng Mặt', () => {
    const e = raw(buildSummaryEmbed(MOCK_SESSION, MOCK_ATTENDED));
    const fieldNames = (e.fields ?? []).map(f => f.name);
    assert.ok(fieldNames.some(n => n.includes('Tham Gia')));
    assert.ok(fieldNames.some(n => n.includes('Vắng Mặt')));
  });

  it('footer chứa role_name', () => {
    const e = raw(buildSummaryEmbed(MOCK_SESSION, MOCK_ATTENDED));
    assert.ok(e.footer?.text?.includes(MOCK_SESSION.role_name));
  });

  it('không crash khi attended = []', () => {
    assert.doesNotThrow(() => buildSummaryEmbed(MOCK_SESSION, []));
  });

  it('eligible = 0 không chia 0 (pct = 0)', () => {
    const emptySession = { ...MOCK_SESSION, eligible_member_ids: [] };
    const e = raw(buildSummaryEmbed(emptySession, []));
    assert.ok(e.description?.includes('0%'));
  });
});
