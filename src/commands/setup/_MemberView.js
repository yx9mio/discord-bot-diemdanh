// src/commands/setup/MemberView.js
// Render trang quản lý thành viên với danh sách + pagination + nút thêm/xoá.
'use strict';
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { COLORS, ICONS } = require('../../../utils/theme.js'); // [PATH] fix: 4→3 levels
const { FOOTER_DEFAULT } = require('../../../utils/embeds.js'); // [PATH] fix: 4→3 levels
const memberService = require('../../../services/memberService.js'); // [PATH] fix: 4→3 levels

const CUSTOM_ID = {
  ADD:          'setup:mem:add',
  PAGE_NEXT:    'setup:mem:page:next',
  PAGE_PREV:    'setup:mem:page:prev',
  DEL_PREFIX:   'setup:mem:del:',    // setup:mem:del:<userId>
  EDIT_PREFIX:  'setup:mem:edit:',   // setup:mem:edit:<userId>
  RESET_PREFIX: 'setup:mem:reset:',  // setup:mem:reset:<userId>
  REFRESH:      'setup:mem:refresh', // [REFRESH-ALL]
  BACK_HOME:    'setup:home',
};

const PAGE_SIZE = 10;

function render({ members, page = 0, guild }) {
  const total = members.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const clampedPage = Math.max(0, Math.min(page, totalPages - 1));
  const start = clampedPage * PAGE_SIZE;
  const slice = members.slice(start, start + PAGE_SIZE);

  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle(`${ICONS.MEMBER} Thành viên — ${guild.name}`)
    .setDescription(
      total === 0
        ? `*Chưa có thành viên nào.*\n> Bấm **${ICONS.PLUS} Thêm thành viên** để bắt đầu.`
        : slice.map((m, i) => {
            const phong = m.phong_ban ? ` _(${m.phong_ban})_` : '';
            const note  = m.ghi_chu ? ` · 📝 ${m.ghi_chu}` : '';
            return `${start + i + 1}. <@${m.user_id}>${phong}${note}`;
          }).join('\n')
    )
    .setFooter({ text: `${FOOTER_DEFAULT} · Trang ${clampedPage + 1}/${totalPages} · Tổng ${total} thành viên` })
    .setTimestamp();

  // Row 1: delete buttons (per member)
  const delRow = new ActionRowBuilder();
  for (const m of slice.slice(0, 5)) {
    delRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`${CUSTOM_ID.DEL_PREFIX}${m.user_id}`)
        .setLabel(`✕ ${m.username ?? m.user_id.slice(0, 8)}`)
        .setStyle(ButtonStyle.Danger),
    );
  }

  // Row 2: edit buttons
  const editRow = new ActionRowBuilder();
  for (const m of slice.slice(0, 5)) {
    editRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`${CUSTOM_ID.EDIT_PREFIX}${m.user_id}`)
        .setLabel(`✎ ${m.username ?? m.user_id.slice(0, 8)}`)
        .setStyle(ButtonStyle.Secondary),
    );
  }

  // Row 3: add + reset
  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.ADD)
      .setLabel('Thêm thành viên')
      .setEmoji(ICONS.PLUS)
      .setStyle(ButtonStyle.Success),
  );
  if (slice.length > 0) {
    actionRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`${CUSTOM_ID.RESET_PREFIX}${slice[0].user_id}`)
        .setLabel('Reset streak')
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('setup:mem:reset:all')
        .setLabel('Reset all')
        .setEmoji('⚠️')
        .setStyle(ButtonStyle.Danger),
    );
  }

  // Row 4: nav + Làm mới + Back  [REFRESH-ALL]
  const navRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.PAGE_PREV)
      .setLabel('◀ Trước')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(clampedPage === 0),
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.PAGE_NEXT)
      .setLabel('Sau ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(clampedPage >= totalPages - 1),
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.REFRESH)
      .setLabel('Làm mới')
      .setEmoji(ICONS.REFRESH)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.BACK_HOME)
      .setLabel('← Bảng điều khiển')
      .setEmoji(ICONS.HOME)
      .setStyle(ButtonStyle.Secondary),
  );

  const components = [];
  if (delRow.components.length > 0) components.push(delRow);
  if (editRow.components.length > 0) components.push(editRow);
  components.push(actionRow);
  components.push(navRow);

  return { embeds: [embed], components, _page: clampedPage, _totalPages: totalPages };
}

// [REFRESH-ALL] Handler: fetch lại members rồi re-render trang hiện tại
async function handleRefresh(interaction, page = 0) {
  await interaction.deferUpdate();
  const members = await memberService.getMembers(interaction.guild.id);
  return interaction.editReply(render({ members, page, guild: interaction.guild }));
}

module.exports = { MemberView: { render, handleRefresh, CUSTOM_ID, PAGE_SIZE } };
