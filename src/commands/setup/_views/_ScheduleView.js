// src/commands/setup/_views/_ScheduleView.js
// [REDESIGN] Rewrite: fix import path, xóa pre_close_minutes (cột không tồn tại),
//            dùng close_hour/close_minute thay thế
'use strict';
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { COLORS, ICONS } = require('../../../../utils/theme.js');
const { FOOTER_DEFAULT } = require('../../../../utils/embeds.js');
const { DAY_NAMES: DAY_VI } = require('../../../../utils/format.js');
const scheduledService = require('../../../../services/scheduledService.js');

const CUSTOM_ID = {
  ADD_R:       'setup:sch:add:r',
  ADD_O:       'setup:sch:add:o',
  PAGE_NEXT:   'setup:sch:page:next',
  PAGE_PREV:   'setup:sch:page:prev',
  DEL_PREFIX:  'setup:sch:del:',
  DEL_CONFIRM: 'setup:sch:del:yes:',
  DEL_CANCEL:  'setup:sch:del:no:',
  EDIT_PREFIX: 'setup:sch:edit:',
  REFRESH:     'setup:sch:refresh',
  BACK_HOME:   'setup:home',
};

const PAGE_SIZE = 5;

function _fmtSchedule(s) {
  const day  = DAY_VI[s.day_of_week] ?? '?';
  const open = `${String(s.hour).padStart(2, '0')}:${String(s.minute).padStart(2, '0')}`;
  const ch   = s.channel_id ? ` · <#${s.channel_id}>` : '';
  // [FIX] dùng close_hour/close_minute thay vì pre_close_minutes (không có trong DB)
  const closeStr = (s.close_hour != null && s.close_minute != null)
    ? ` · ⏹ đóng ${String(s.close_hour).padStart(2, '0')}:${String(s.close_minute).padStart(2, '0')}`
    : '';
  const remind = s.reminder_1_min != null ? ` · 🔔 ${s.reminder_1_min}p` : '';
  return `**${day} ${open}** — ${s.session_name ?? 'Phiên'}${closeStr}${remind}${ch}`;
}

function render({ schedules, page = 0, guild }) {
  const total      = schedules.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const cPage      = Math.max(0, Math.min(page, totalPages - 1));
  const start      = cPage * PAGE_SIZE;
  const slice      = schedules.slice(start, start + PAGE_SIZE);

  const desc = total === 0
    ? `*Chưa có lịch cố định nào.*\n> Bấm **+ Thêm hằng tuần** hoặc **+ Thêm một lần** để tạo.`
    : slice.map((s, i) => `${start + i + 1}. ${_fmtSchedule(s)}`).join('\n');

  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle(`${ICONS.CALENDAR} Lịch cố định — ${guild.name}`)
    .setDescription(desc)
    .setFooter({ text: `${FOOTER_DEFAULT} · Trang ${cPage + 1}/${totalPages} · Tổng ${total} lịch` })
    .setTimestamp();

  const components = [];

  // Nút xóa — mỗi lịch trong trang hiện tại
  if (slice.length > 0) {
    const delRow = new ActionRowBuilder();
    for (const s of slice) {
      const label = `✕ ${DAY_VI[s.day_of_week]} ${String(s.hour).padStart(2, '0')}:${String(s.minute).padStart(2, '0')}`;
      delRow.addComponents(
        new ButtonBuilder().setCustomId(`${CUSTOM_ID.DEL_PREFIX}${s.id}`).setLabel(label).setStyle(ButtonStyle.Danger),
      );
    }
    components.push(delRow);
  }

  const ctrlRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(CUSTOM_ID.ADD_R).setLabel('+ Hằng tuần').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(CUSTOM_ID.ADD_O).setLabel('+ Một lần').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.PAGE_PREV).setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(cPage === 0),
    new ButtonBuilder().setCustomId(CUSTOM_ID.PAGE_NEXT).setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(cPage >= totalPages - 1),
  );

  const navRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(CUSTOM_ID.REFRESH).setLabel('Làm mới').setEmoji(ICONS.REFRESH).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.BACK_HOME).setLabel('← Dashboard').setEmoji(ICONS.HOME).setStyle(ButtonStyle.Secondary),
  );

  components.push(ctrlRow, navRow);
  return { embeds: [embed], components, _page: cPage, _totalPages: totalPages };
}

async function handleRefresh(interaction, page = 0) {
  await interaction.deferUpdate();
  const schedules = await scheduledService.getScheduledSessions(interaction.guild.id);
  return interaction.editReply(render({ schedules, page, guild: interaction.guild }));
}

module.exports = { ScheduleView: { render, handleRefresh, CUSTOM_ID, PAGE_SIZE } };
