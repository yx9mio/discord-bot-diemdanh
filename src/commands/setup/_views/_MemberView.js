// src/commands/setup/_views/_MemberView.js
// [REDESIGN] Rewrite: fix import path, fix delRow/editRow pagination bug
//            (cũ: luôn lấy slice[0..5] thay vì đúng page)
'use strict';
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { COLORS, ICONS } = require('../../../../utils/theme.js');
const { FOOTER_DEFAULT } = require('../../../../utils/embeds.js');
const memberService = require('../../../../services/memberService.js');

const CUSTOM_ID = {
  ADD:          'setup:mem:add',
  PAGE_NEXT:    'setup:mem:page:next',
  PAGE_PREV:    'setup:mem:page:prev',
  DEL_PREFIX:   'setup:mem:del:',
  EDIT_PREFIX:  'setup:mem:edit:',
  RESET_PREFIX: 'setup:mem:reset:',
  RESET_ALL:    'setup:mem:reset:all',
  REFRESH:      'setup:mem:refresh',
  BACK_HOME:    'setup:home',
};

const PAGE_SIZE = 10;
// Discord giới hạn 5 nút/row và tối đa 5 rows — chỉ render del+edit cho 5 item đầu trang
const BTN_LIMIT = 5;

function render({ members, page = 0, guild }) {
  const total      = members.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const cPage      = Math.max(0, Math.min(page, totalPages - 1));
  const start      = cPage * PAGE_SIZE;
  const slice      = members.slice(start, start + PAGE_SIZE);
  // [FIX] btnSlice = đúng 5 item của trang hiện tại, không phải slice[0..5] cứng
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
    const delRow = new ActionRowBuilder();
    for (const m of btnSlice)
      delRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`${CUSTOM_ID.DEL_PREFIX}${m.user_id}`)
          .setLabel(`✕ ${(m.username ?? m.user_id).slice(0, 10)}`)
          .setStyle(ButtonStyle.Danger),
      );
    components.push(delRow);

    const editRow = new ActionRowBuilder();
    for (const m of btnSlice)
      editRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`${CUSTOM_ID.EDIT_PREFIX}${m.user_id}`)
          .setLabel(`✎ ${(m.username ?? m.user_id).slice(0, 10)}`)
          .setStyle(ButtonStyle.Secondary),
      );
    components.push(editRow);
  }

  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(CUSTOM_ID.ADD).setLabel('Thêm thành viên').setEmoji(ICONS.PLUS).setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`${CUSTOM_ID.RESET_PREFIX}${slice[0]?.user_id ?? 'none'}`)
      .setLabel('Reset streak').setEmoji('🔄').setStyle(ButtonStyle.Danger).setDisabled(slice.length === 0),
    new ButtonBuilder().setCustomId(CUSTOM_ID.RESET_ALL).setLabel('Reset tất cả').setEmoji(ICONS.WARN).setStyle(ButtonStyle.Danger),
  );

  const navRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(CUSTOM_ID.PAGE_PREV).setLabel('◀ Trước').setStyle(ButtonStyle.Secondary).setDisabled(cPage === 0),
    new ButtonBuilder().setCustomId(CUSTOM_ID.PAGE_NEXT).setLabel('Sau ▶').setStyle(ButtonStyle.Secondary).setDisabled(cPage >= totalPages - 1),
    new ButtonBuilder().setCustomId(CUSTOM_ID.REFRESH).setLabel('Làm mới').setEmoji(ICONS.REFRESH).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.BACK_HOME).setLabel('← Dashboard').setEmoji(ICONS.HOME).setStyle(ButtonStyle.Secondary),
  );

  components.push(actionRow, navRow);
  return { embeds: [embed], components, _page: cPage, _totalPages: totalPages };
}

async function handleRefresh(interaction, page = 0) {
  await interaction.deferUpdate();
  const members = await memberService.getMembers(interaction.guild.id);
  return interaction.editReply(render({ members, page, guild: interaction.guild }));
}

module.exports = { MemberView: { render, handleRefresh, CUSTOM_ID, PAGE_SIZE } };
