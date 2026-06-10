'use strict';
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { COLORS, ICONS } = require('../../../../utils/theme.js');
const { FOOTER_DEFAULT } = require('../../../../utils/embeds.js');
const { DAY_NAMES: DAY_VI } = require('../../../../utils/format.js');

const CUSTOM_ID = {
  HOME:      'setup:home',
  CFG:       'setup:cfg',
  SCH:       'setup:sch',
  MEM:       'setup:mem',
  SESSION:   'setup:session',
  START:     'setup:session:start',
  REFRESH:   'setup:home:refresh',
  HISTORY:   'setup:history',
  BROADCAST: 'setup:session:broadcast',
  STATS:     'setup:stats',
  INACTIVE:  'setup:inactive',
};

function _fmtSchedule(s) {
  const day  = DAY_VI[s.day_of_week] ?? '?';
  const time = `${String(s.hour).padStart(2, '0')}:${String(s.minute).padStart(2, '0')}`;
  const remind = s.reminder_1_min != null ? ` ⏱️ ${s.reminder_1_min}p` : '';
  return `**${day} ${time}** — ${s.session_name ?? 'Phiên'}${remind}`;
}

function _phaiRoles(cfg) {
  const ids = cfg?.phai_role_ids ?? [];
  if (!ids.length) return '_Tất cả_';
  return ids.map(id => `<@&${id}>`).join(' ');
}

function render({ guild, cfg, schedules, members, session, sessions }) {
  const phaiText = _phaiRoles(cfg);

  const activeSessions = sessions ?? (session ? [session] : []);

  const phaiRole = (cfg?.phai_role_ids ?? [])
    .map(id => guild?.roles?.cache?.get(id))
    .find(r => r?.icon);

  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle(`${ICONS.HOME} Bảng điều khiển — ${guild.name}`)
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();

  if (phaiRole?.icon) {
    embed.setThumbnail(phaiRole.iconURL({ size: 64 }));
  } else {
    embed.setThumbnail(guild.iconURL({ size: 64 }) ?? null);
  }

  const cnt = activeSessions.length;
  if (cnt > 0) {
    const s    = activeSessions[0];
    const ch   = s.channel_id ? `<#${s.channel_id}>` : '_chưa có_';
    const by   = s.started_by ? `<@${s.started_by}>` : 'không rõ';
    const name = s.session_name ?? 'Phiên';
    embed.addFields({
      name: `${ICONS.SESSION} Phiên đang mở`,
      value: `**${cnt} phiên đang mở**${cnt > 1 ? ` (hiện: **${name}**)` : ` — **${name}**`}\n▸ ${ch} · bởi ${by}`,
    });
  } else {
    embed.addFields({
      name: `${ICONS.SESSION} Phiên đang mở`,
      value: `_Chưa có phiên nào._ Bấm **${ICONS.PLUS} Mở phiên mới** để bắt đầu.`,
    });
  }

  const tz      = cfg?.timezone ?? 'Asia/Ho_Chi_Minh';
  const channel = cfg?.notification_channel_id ? `<#${cfg.notification_channel_id}>` : '_chưa cài_';
  embed.addFields({
    name: `${ICONS.GEAR} Cài đặt chung`,
    value: [
      `▸ ${ICONS.CHANNEL} **Kênh log:** ${channel}`,
      `▸ **Phái:** ${phaiText}`,
      `▸ ${ICONS.GLOBE} **Timezone:** \`${tz}\``,
    ].join('\n'),
  });

  if (schedules?.length) {
    const top  = schedules.slice(0, 3).map((s, i) => `${i + 1}. ${_fmtSchedule(s)}`).join('\n');
    const more = schedules.length > 3 ? `\n_...và ${schedules.length - 3} lịch khác_` : '';
    embed.addFields({
      name: `${ICONS.CALENDAR} Lịch cố định`,
      value: `${top}${more}`,
    });
  } else {
    embed.addFields({
      name: `${ICONS.CALENDAR} Lịch cố định`,
      value: `_Chưa có lịch._ Bấm **${ICONS.PLUS} Quản lý lịch** để thêm.`,
    });
  }

  embed.addFields({
    name: `${ICONS.MEMBER} Thành viên`,
    value: `**${members?.length ?? 0} thành viên** đang quản lý`,
  });

  const navRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(CUSTOM_ID.CFG).setLabel('Cài đặt').setEmoji(ICONS.GEAR).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.SCH).setLabel('Lịch cố định').setEmoji(ICONS.CALENDAR).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.MEM).setLabel('Thành viên').setEmoji(ICONS.MEMBER).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.HISTORY).setLabel('Nhật ký').setEmoji(ICONS.CHART).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.STATS).setLabel('Thống kê').setEmoji(ICONS.TROPHY).setStyle(ButtonStyle.Secondary),
  );

  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(CUSTOM_ID.START).setLabel('Mở phiên mới').setEmoji(ICONS.PLUS).setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(CUSTOM_ID.SESSION).setLabel('Quản lý phiên').setEmoji(ICONS.SESSION).setStyle(cnt > 0 ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.REFRESH).setLabel('Làm mới').setEmoji(ICONS.REFRESH).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.BROADCAST).setLabel('Phát tin').setEmoji(ICONS.BELL).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.INACTIVE).setLabel('Không hoạt động').setEmoji(ICONS.INACTIVE).setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [navRow, actionRow] };
}

module.exports = { HomeView: { render, CUSTOM_ID } };
