'use strict';
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { COLORS, ICONS, getPhaiIcon } = require('../../../../utils/theme.js');
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
};

function _fmtSchedule(s) {
  const day  = DAY_VI[s.day_of_week] ?? '?';
  const time = `${String(s.hour).padStart(2, '0')}:${String(s.minute).padStart(2, '0')}`;
  const remind = s.reminder_1_min != null ? ` ⏱️ ${s.reminder_1_min}p` : '';
  return `**${day} ${time}** — ${s.session_name ?? 'Phiên'}${remind}`;
}

function _buildStatusBanner(cfg, members) {
  const hasChannel = !!cfg?.notification_channel_id;
  const hasMembers = (members?.length ?? 0) > 0;
  const allDone = hasChannel && hasMembers;

  if (allDone) {
    return `🎉 **Sẵn sàng!** Nhấn **${ICONS.PLUS} Mở phiên mới** để bắt đầu điểm danh.`;
  }

  const steps = [];
  if (!hasChannel) steps.push(`⬜ \`───\` **Cài đặt chung**: chọn kênh thông báo + timezone`);
  if (!hasMembers) steps.push(`⬜ \`───\` **Thành viên**: thêm người vào hệ thống`);
  steps.push(`📌 \`───\` **Lịch cố định**: (tùy chọn) tạo lịch tự động`);

  return steps.join('\n');
}

function render({ guild, cfg, schedules, members, session, sessions }) {
  const activeSessions = sessions ?? (session ? [session] : []);

  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle(`${ICONS.HOME} Bảng điều khiển — ${guild.name}`)
    .setThumbnail(guild.iconURL({ size: 64 }) ?? null)
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();

  const hasChannel = !!cfg?.notification_channel_id;
  const hasMembers = (members?.length ?? 0) > 0;

  if (!hasChannel || !hasMembers) {
    embed.addFields({ name: '📋 Bắt đầu nhanh', value: _buildStatusBanner(cfg, members), inline: false });
  }

  const cnt = activeSessions.length;
  if (cnt > 0) {
    const s    = activeSessions[0];
    const ch   = s.channel_id ? `<#${s.channel_id}>` : 'Chưa có kênh';
    const by   = s.started_by ? `<@${s.started_by}>` : 'không rõ';
    const name = s.session_name ?? 'Phiên';
    const sessionLine = cnt === 1
      ? `**${name}** · ${ch} · bởi ${by}`
      : `**${name}** + ${cnt - 1} phiên khác · ${ch} · bởi ${by}`;
    embed.addFields({
      name: `${ICONS.SESSION} Phiên đang mở`,
      value: sessionLine,
      inline: false,
    });
  } else {
    embed.addFields({
      name: `${ICONS.SESSION} Phiên đang mở`,
      value: `Chưa có phiên nào. Bấm **${ICONS.PLUS} Mở phiên mới** để bắt đầu.`,
      inline: false,
    });
  }

  const tz      = cfg?.timezone ?? 'Asia/Ho_Chi_Minh';
  const channel = cfg?.notification_channel_id ? `<#${cfg.notification_channel_id}>` : 'Chưa cài';
  embed.addFields(
    { name: `${ICONS.GEAR} Cài đặt chung`, value: `${ICONS.CHANNEL} ${channel} ${ICONS.GLOBE} \`${tz}\``, inline: false },
  );

  if (schedules?.length) {
    const top  = schedules.slice(0, 3).map((s, i) => `${i + 1}. ${_fmtSchedule(s)}`).join('\n');
    const more = schedules.length > 3 ? `\n_...và ${schedules.length - 3} lịch khác_` : '';
    embed.addFields({
      name: `${ICONS.CALENDAR} Lịch cố định`,
      value: `${top}${more}`,
      inline: false,
    });
  } else {
    embed.addFields({
      name: `${ICONS.CALENDAR} Lịch cố định`,
      value: `Chưa có lịch. Bấm **${ICONS.PLUS} Quản lý lịch** để thêm.`,
      inline: false,
    });
  }

  const phaiIds = cfg?.phai_role_ids ?? [];
  let phaiBreakdown = '';
  if (phaiIds.length && members?.length) {
    phaiBreakdown = phaiIds.map(rid => {
      const count = members.filter(m => (m.phai_role_ids ?? []).includes(rid)).length;
      const icon  = getPhaiIcon(rid, phaiIds, guild);
      const role  = guild?.roles?.cache?.get(rid);
      return count > 0 ? `${icon} ${role?.name ?? rid}: ${count}` : null;
    }).filter(Boolean).join('  ');
  }

  embed.addFields({
    name: `${ICONS.MEMBER} Thành viên`,
    value: `${members?.length ?? 0} người${phaiBreakdown ? `\n${phaiBreakdown}` : ''}`,
    inline: false,
  });

  const navRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(CUSTOM_ID.CFG).setLabel('Cài đặt').setEmoji(ICONS.GEAR).setStyle(hasChannel ? ButtonStyle.Secondary : ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.SCH).setLabel('Lịch cố định').setEmoji(ICONS.CALENDAR).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.MEM).setLabel('Thành viên').setEmoji(ICONS.MEMBER).setStyle(hasMembers ? ButtonStyle.Secondary : ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.HISTORY).setLabel('Nhật ký').setEmoji(ICONS.CHART).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.STATS).setLabel('Thống kê').setEmoji(ICONS.TROPHY).setStyle(ButtonStyle.Secondary),
  );

  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(CUSTOM_ID.START).setLabel('Mở phiên mới').setEmoji(ICONS.PLUS).setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(CUSTOM_ID.SESSION).setLabel('Quản lý phiên').setEmoji(ICONS.SESSION).setStyle(cnt > 0 ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.REFRESH).setLabel('Làm mới').setEmoji(ICONS.REFRESH).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.BROADCAST).setLabel('Phát tin').setEmoji(ICONS.BELL).setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [navRow, actionRow] };
}

module.exports = { HomeView: { render, CUSTOM_ID } };
