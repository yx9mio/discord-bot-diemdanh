// src/commands/setup/_ScheduleView.js
// Render trang quản lý lịch cố định với danh sách + nút thêm/sửa/xoá từng dòng.
'use strict';
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { COLORS, ICONS } = require('../../../utils/theme.js'); // [PATH] fix: 4→3 levels
const { FOOTER_DEFAULT } = require('../../../utils/embeds.js'); // [PATH] fix: 4→3 levels
const { DAY_NAMES: DAY_VI } = require('../../../utils/format.js'); // [PATH] fix: 4→3 levels
const scheduledService = require('../../../services/scheduledService.js'); // [PATH] fix: 4→3 levels

const CUSTOM_ID = {
  ADD_R:       'setup:sch:add:r',
  ADD_O:       'setup:sch:add:o',
  PAGE_NEXT:   'setup:sch:page:next',
  PAGE_PREV:   'setup:sch:page:prev',
  DEL_PREFIX:  'setup:sch:del:',
  DEL_CONFIRM: 'setup:sch:del:yes:',
  DEL_CANCEL:  'setup:sch:del:no:',
  EDIT_PREFIX: 'setup:sch:edit:',
  REFRESH:     'setup:sch:refresh',   // [REFRESH-ALL]
  BACK_HOME:   'setup:home',
};

const PAGE_SIZE = 5;

function fmtSchedule(s) {
  const pc = s.pre_close_minutes ? ` · ⏱️ đóng DD trước ${s.pre_close_minutes}p` : '';
  const ch = s.channel_id ? ` · <#${s.channel_id}>` : '';
  return `**${DAY_VI[s.day_of_week]} ${String(s.hour).padStart(2,'0')}:${String(s.minute).padStart(2,'0')}** — ${s.session_name ?? 'Phiên'}${pc}${ch}`;
}

function render({ schedules, page = 0, guild }) {
  const total = schedules.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const clampedPage = Math.max(0, Math.min(page, totalPages - 1));
  const start = clampedPage * PAGE_SIZE;
  const slice = schedules.slice(start, start + PAGE_SIZE);

  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle(`${ICONS.CALENDAR} Lịch cố định — ${guild.name}`)
    .setDescription(
      total === 0
        ? `*Chưa có lịch cố định nào.*\n> Bấm **+ Thêm hằng tuần** hoặc **+ Thêm một lần** để tạo lịch mới.`
        : slice.map((s, i) => `${start + i + 1}. ${fmtSchedule(s)}`).join('\n')
    )
    .setFooter({ text: `${FOOTER_DEFAULT} · Trang ${clampedPage + 1}/${totalPages} · Tổng ${total} lịch` })
    .setTimestamp();

  // Row 1: nút xoá từng lịch trong trang
  const delRow = new ActionRowBuilder();
  if (total > 0) {
    for (const s of slice) {
      delRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`${CUSTOM_ID.DEL_PREFIX}${s.id}`)
          .setLabel(`✕ ${DAY_VI[s.day_of_week]} ${String(s.hour).padStart(2,'0')}:${String(s.minute).padStart(2,'0')}`)
          .setStyle(ButtonStyle.Danger),
      );
    }
  }

  // Row 2: thêm + nav  [REFRESH-ALL] thêm nút Làm mới
  const ctrlRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.ADD_R)
      .setLabel('+ Thêm hằng tuần')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.ADD_O)
      .setLabel('+ Thêm một lần')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.PAGE_PREV)
      .setLabel('◀')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(clampedPage === 0),
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.PAGE_NEXT)
      .setLabel('▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(clampedPage >= totalPages - 1),
  );

  // Row 3: Làm mới + Back  [REFRESH-ALL]
  const navRow = new ActionRowBuilder().addComponents(
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
  components.push(ctrlRow);
  components.push(navRow);

  return { embeds: [embed], components, _page: clampedPage, _totalPages: totalPages };
}

// [REFRESH-ALL] Handler: fetch lại schedules rồi re-render
async function handleRefresh(interaction, page = 0) {
  await interaction.deferUpdate();
  const schedules = await scheduledService.getScheduledSessions(interaction.guild.id);
  return interaction.editReply(render({ schedules, page, guild: interaction.guild }));
}

module.exports = { ScheduleView: { render, handleRefresh, CUSTOM_ID, PAGE_SIZE } };
