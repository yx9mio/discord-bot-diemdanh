'use strict';
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const { COLORS } = require('../../../../utils/theme.js');
const { FOOTER_DEFAULT, buildAuthor } = require('../../../../utils/embeds.js');

const ACTION_LABELS = {
  OWNER_BYPASS:   { emoji: '🔴', label: 'Bỏ qua chủ sở hữu' },
  ADMIN_MARK:     { emoji: '📝', label: 'Điểm danh thủ công' },
  ADMIN_EDIT:     { emoji: '✏️',  label: 'Sửa điểm danh' },
  SESSION_CREATE:  { emoji: '⚔️',  label: 'Mở Bang Chiến' },
  SESSION_CLOSE:   { emoji: '🔒',  label: 'Đóng Bang Chiến' },
  SESSION_CANCEL:  { emoji: '⛔',  label: 'Hủy Bang Chiến' },
  SCHEDULE_CREATE: { emoji: '📅',  label: 'Tạo lịch' },
  SCHEDULE_UPDATE: { emoji: '✏️',  label: 'Sửa lịch' },
  SCHEDULE_DELETE: { emoji: '🗑️',  label: 'Xóa lịch' },
  MEMBER_ADD:      { emoji: '➕',  label: 'Thêm thành viên' },
  MEMBER_UPDATE:   { emoji: '✏️',  label: 'Sửa thành viên' },
  MEMBER_REMOVE:   { emoji: '➖',  label: 'Xóa thành viên' },
  CONFIG_UPDATE:   { emoji: '⚙️',  label: 'Thay đổi thiết lập' },
  RESET_STREAK:    { emoji: '🔄',  label: 'Reset streak' },
};

function actionLabel(action) {
  const entry = ACTION_LABELS[action];
  return entry ? `${entry.emoji} ${entry.label}` : `❓ ${action}`;
}

const CUSTOM_ID = {
  AUDIT:     'setup:audit',
  NEXT:      'setup:audit:next',
  PREV:      'setup:audit:prev',
  FILTER:    'setup:audit:filter',
  FILTER_ALL:'setup:audit:filter:all',
  REFRESH:   'setup:audit:refresh',
  BACK_HOME: 'setup:home',
};

const PAGE_SIZE = 6;

const FILTER_GROUPS = {
  SESSION:       ['SESSION_CREATE', 'SESSION_CLOSE', 'SESSION_CANCEL'],
  SCHEDULE:      ['SCHEDULE_CREATE', 'SCHEDULE_UPDATE', 'SCHEDULE_DELETE'],
  MEMBER:        ['MEMBER_ADD', 'MEMBER_UPDATE', 'MEMBER_REMOVE'],
  ADMIN:         ['OWNER_BYPASS', 'ADMIN_MARK', 'ADMIN_EDIT', 'RESET_STREAK'],
  CONFIG_UPDATE: ['CONFIG_UPDATE'],
};

function expandFilter(value) {
  if (!value || value === 'all') return null;
  if (FILTER_GROUPS[value]) return FILTER_GROUPS[value];
  return [value];
}

const FILTER_ACTIONS = [
  { value: 'all',          label: 'Tất cả',                emoji: '📋' },
  { value: 'SESSION',      label: 'Bang Chiến',            emoji: '⚔️' },
  { value: 'SCHEDULE',     label: 'Lịch',                   emoji: '📅' },
  { value: 'MEMBER',       label: 'Thành viên',             emoji: '👤' },
  { value: 'CONFIG_UPDATE',label: 'Cài Đặt',               emoji: '⚙️' },
  { value: 'ADMIN',        label: 'Admin',                  emoji: '🛡️' },
];

function _footer(actionFilter, page, totalPages, total) {
  let s = `📜 Log · Trang ${page + 1}/${totalPages}`;
  if (total) s += ` · ${total} mục`;
  if (actionFilter && actionFilter !== 'all') s += ` · Lọc: ${actionFilter}`;
  return s;
}

function _entryLines(entries) {
  return entries.map((r, i) => {
    const ts = Math.floor(new Date(r.created_at).getTime() / 1000);
    const lines = [
      `${actionLabel(r.action)} · <@${r.actor_id}>`,
      `<t:${ts}:R>${r.target_id ? ` · \`${r.target_id}\`` : ''}`,
    ];
    if (r.metadata && Object.keys(r.metadata).length > 0) {
      const extra = Object.entries(r.metadata).slice(0, 2)
        .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
        .join(', ');
      if (extra) lines[1] += `\n▸ ${extra}`;
    }
    return lines.join('\n');
  });
}

function render({ rows, page = 0, actionFilter = 'all', guild, totalCount }) {
  const safe = Array.isArray(rows) ? rows : [];
  const total = totalCount ?? safe.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const cPage = Math.max(0, Math.min(page, totalPages - 1));

  const desc = safe.length === 0
    ? '*Chưa có nhật ký nào.*'
    : _entryLines(safe).join('\n\n');

  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setAuthor(buildAuthor(guild))
    .setTitle('📜 Nhật ký Bang')
    .setDescription(desc)
    .setFooter({ text: _footer(actionFilter, cPage, totalPages, total) })
    .setTimestamp();

  const navRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(CUSTOM_ID.PREV).setLabel('◀ Trước').setStyle(ButtonStyle.Secondary).setDisabled(cPage === 0),
    new ButtonBuilder().setCustomId(CUSTOM_ID.NEXT).setLabel('Sau ▶').setStyle(ButtonStyle.Secondary).setDisabled(cPage >= totalPages - 1),
    new ButtonBuilder().setCustomId(CUSTOM_ID.REFRESH).setLabel('Làm mới').setEmoji('🔄').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.BACK_HOME).setLabel('← Trung tâm').setEmoji('🏠').setStyle(ButtonStyle.Secondary),
  );

  const filterSelect = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(CUSTOM_ID.FILTER)
      .setPlaceholder(actionFilter !== 'all' ? `Lọc: ${actionFilter}` : 'Lọc theo loại...')
      .addOptions(
        FILTER_ACTIONS.map(f =>
          new StringSelectMenuOptionBuilder()
            .setLabel(f.label)
            .setValue(f.value)
            .setEmoji(f.emoji)
            .setDefault(f.value === actionFilter)
        ),
      ),
  );

  return { embeds: [embed], components: [filterSelect, navRow] };
}

module.exports = { AuditView: { render, CUSTOM_ID, PAGE_SIZE, expandFilter, FILTER_GROUPS } };
