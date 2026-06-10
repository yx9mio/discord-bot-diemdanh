// src/commands/setup/_views/_MemberView.js
// [FIX] + buildEditModal(userId, currentData)
//       + per-user reset-streak button (thay thế nút reset sai logic đầu trang)
'use strict';
const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const { COLORS, ICONS } = require('../../../../utils/theme.js');
const { FOOTER_DEFAULT } = require('../../../../utils/embeds.js');

const CUSTOM_ID = {
  ADD:                'setup:mem:add',
  MEMBER:             'setup:mem',
  PAGE_NEXT:          'setup:mem:page:next',
  PAGE_PREV:          'setup:mem:page:prev',
  DEL_PREFIX:         'setup:mem:del:',
  DEL_CONFIRM_PREFIX: 'setup:mem:del:confirm:',
  DEL_CANCEL_PREFIX:  'setup:mem:del:cancel:',
  EDIT_PREFIX:        'setup:mem:edit:',
  RESET_PREFIX:       'setup:mem:reset:',
  RESET_ALL:          'setup:mem:reset:all',
  REFRESH:            'setup:mem:refresh',
  BACK_HOME:          'setup:home',
};

const PAGE_SIZE = 10;
// Discord giới hạn 5 nút/row và tối đa 5 rows
// del+edit+reset = 3 rows × 5 thành viên → còn 2 rows cho action + nav
const BTN_LIMIT = 5;

// ─── Modal chỉnh sửa thành viên ──────────────────────────────────────
/**
 * Trả về ModalBuilder để handler gọi interaction.showModal(modal).
 * @param {string} userId
 * @param {{ username?: string, phong_ban?: string, ghi_chu?: string }} currentData
 */
function buildEditModal(userId, currentData = {}) {
  return new ModalBuilder()
    .setCustomId(`setup:mem:edit:modal:${userId}`)
    .setTitle('Chỉnh sửa thành viên')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('username')
          .setLabel('Tên hiển thị (để trống = giữ nguyên)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(80)
          .setValue(currentData.username ?? ''),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('phong_ban')
          .setLabel('Phòng ban')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(60)
          .setValue(currentData.phong_ban ?? ''),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('ghi_chu')
          .setLabel('Ghi chú')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setMaxLength(200)
          .setValue(currentData.ghi_chu ?? ''),
      ),
    );
}

// ─── Modal thêm thành viên ───────────────────────────────────────────
function buildAddModal() {
  return new ModalBuilder()
    .setCustomId('setup:mem:add:modal')
    .setTitle('Thêm thành viên')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('user_id')
          .setLabel('ID người dùng (Discord ID)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(30)
          .setPlaceholder('Ví dụ: 123456789012345678'),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('username')
          .setLabel('Tên hiển thị')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(80),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('phong_ban')
          .setLabel('Phòng ban')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(60),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('ghi_chu')
          .setLabel('Ghi chú')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setMaxLength(200),
      ),
    );
}

// ─── Render view ─────────────────────────────────────────────────────
function render({ members, page = 0, guild }) {
  const safe      = Array.isArray(members) ? members : [];
  const total      = safe.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const cPage      = Math.max(0, Math.min(page, totalPages - 1));
  const start      = cPage * PAGE_SIZE;
  const slice      = safe.slice(start, start + PAGE_SIZE);
  // [FIX] btnSlice = đúng 5 item của trang hiện tại
  const btnSlice   = slice.slice(0, BTN_LIMIT);

  const desc = total === 0
    ? `*Chưa có thành viên nào.*\n> Bấm **${ICONS.PLUS} Thêm thành viên** để bắt đầu.`
    : slice.map((m, i) => {
        const phong = m.phong_ban ? ` _(${m.phong_ban})_` : '';
        const note  = m.ghi_chu   ? ` · 📝 ${m.ghi_chu}` : '';
        return `${start + i + 1}. <@${m.user_id}>${phong}${note}`;
      }).join('\n');

  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle(`${ICONS.MEMBER} Thành viên — ${guild.name}`)
    .setDescription(desc)
    .setFooter({ text: `${FOOTER_DEFAULT} · Trang ${cPage + 1}/${totalPages} · Tổng ${total} thành viên` })
    .setTimestamp();

  const components = [];

  if (btnSlice.length > 0) {
    // Row 1: Nút xoá per-user
    const delRow = new ActionRowBuilder();
    for (const m of btnSlice)
      delRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`${CUSTOM_ID.DEL_PREFIX}${m.user_id}`)
          .setLabel(`✕ ${(m.username ?? m.user_id).slice(0, 10)}`)
          .setStyle(ButtonStyle.Danger),
      );
    components.push(delRow);

    // Row 2: Nút chỉnh sửa per-user
    const editRow = new ActionRowBuilder();
    for (const m of btnSlice)
      editRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`${CUSTOM_ID.EDIT_PREFIX}${m.user_id}`)
          .setLabel(`✎ ${(m.username ?? m.user_id).slice(0, 10)}`)
          .setStyle(ButtonStyle.Secondary),
      );
    components.push(editRow);

    // Row 3: Nút reset streak per-user
    // [FIX] Thay thế nút reset sai logic (slice[0]?.user_id cứng) bằng per-user row
    const resetRow = new ActionRowBuilder();
    for (const m of btnSlice)
      resetRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`${CUSTOM_ID.RESET_PREFIX}${m.user_id}`)
          .setLabel(`↺ ${(m.username ?? m.user_id).slice(0, 10)}`)
          .setStyle(ButtonStyle.Primary),
      );
    components.push(resetRow);
  }

  // Row 4: Actions (thêm + reset-all)
  // [FIX] Bỏ nút reset-streak đầu trang sai logic khỏi đây
  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(CUSTOM_ID.ADD).setLabel('Thêm thành viên').setEmoji(ICONS.PLUS).setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(CUSTOM_ID.RESET_ALL).setLabel('Reset tất cả').setEmoji(ICONS.WARN).setStyle(ButtonStyle.Danger),
  );

  // Row 5: Nav
  const navRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(CUSTOM_ID.PAGE_PREV).setLabel('◀ Trước').setStyle(ButtonStyle.Secondary).setDisabled(cPage === 0),
    new ButtonBuilder().setCustomId(CUSTOM_ID.PAGE_NEXT).setLabel('Sau ▶').setStyle(ButtonStyle.Secondary).setDisabled(cPage >= totalPages - 1),
    new ButtonBuilder().setCustomId(CUSTOM_ID.REFRESH).setLabel('Làm mới').setEmoji(ICONS.REFRESH).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.BACK_HOME).setLabel('← Dashboard').setEmoji(ICONS.HOME).setStyle(ButtonStyle.Secondary),
  );

  components.push(actionRow, navRow);
  return { embeds: [embed], components, _page: cPage, _totalPages: totalPages };
}

module.exports = { MemberView: { render, buildAddModal, buildEditModal, CUSTOM_ID, PAGE_SIZE } };
