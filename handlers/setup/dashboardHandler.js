// handlers/setup/dashboardHandler.js — buildDashboard + buildDashboardStats
'use strict';
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../db.js');
const { FOOTER_DEFAULT, AUTHOR_DEFAULT } = require('../../utils/embeds.js');
const { ngayThucTe, formatDongStr } = require('./helpers.js');

async function timKenhThongBao(guild) {
  try {
    const cfg = await db.getConfig(guild.id);
    if (cfg?.channel_id) {
      const ch = await guild.channels.fetch(cfg.channel_id).catch(() => null);
      if (ch) return ch;
    }
  } catch (_e) { /* bỏ qua */ }
  return null;
}

async function buildDashboard(guild) {
  const cfg      = await db.getConfig(guild.id);
  const lichList = await db.getLichCoDinh(guild.id);

  const channelMention = cfg?.channel_id ? `<#${cfg.channel_id}>` : '_(chưa cấu hình)_';
  const roleMention    = cfg?.allowed_role_id ? `<@&${cfg.allowed_role_id}>` : '_(tất cả)_';
  const timezone       = cfg?.timezone ?? 'Asia/Ho_Chi_Minh';

  const phaiRoles = (cfg?.phai_role_ids ?? []);
  const phaiText  = phaiRoles.length > 0
    ? phaiRoles.map(id => `<@&${id}>`).join(' ')
    : '_(chưa thiết lập)_';

  // Lịch cố định summary
  let lichText = '_(chưa có lịch)_';
  if (lichList.length > 0) {
    lichText = lichList.slice(0, 5).map(l => {
      const moLine  = ngayThucTe(l.day_of_week, l.open_hour, l.open_minute).label;
      const dongLine = l.close_day_of_week != null
        ? formatDongStr(l.close_day_of_week, l.close_hour, l.close_minute)
        : 'Thủ công';
      return `• **${l.session_name}** — Mở: ${moLine} | Đóng: ${dongLine}`;
    }).join('\n');
    if (lichList.length > 5) lichText += `\n_(và ${lichList.length - 5} lịch khác)_`;
  }

  const embed = new EmbedBuilder()
    .setAuthor({ name: AUTHOR_DEFAULT })
    .setColor(0x5865F2)
    .setTitle('⚙️ Cấu hình Bot Điểm Danh')
    .addFields(
      { name: '📌 Kênh điểm danh', value: channelMention, inline: true },
      { name: '🎭 Role',           value: roleMention,    inline: true },
      { name: '🌐 Timezone',       value: timezone,       inline: true },
      { name: '⚔️ Phái',           value: phaiText,       inline: false },
      { name: '📅 Lịch cố định',   value: lichText,       inline: false },
    )
    .setFooter({ text: FOOTER_DEFAULT });

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('setup:channel:open').setLabel('📌 Kênh').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('setup:role:open').setLabel('🎭 Role').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('setup:timezone:open').setLabel('🌐 Timezone').setStyle(ButtonStyle.Secondary),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('setup:phai:open').setLabel('⚔️ Phái').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('setup:lich:menu').setLabel('📅 Lịch').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('setup:preset:menu').setLabel('📋 Preset').setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row1, row2] };
}

async function buildDashboardStats(guild) {
  try {
    const sessions = await db.getRecentSessions(guild.id, 7);
    if (!sessions?.length) return null;

    const total   = sessions.length;
    const avgRate = sessions.reduce((s, sess) => {
      const el = (sess.eligible_member_ids ?? []).length;
      if (!el) return s;
      const attended = (sess.attendances ?? []).filter(a => a.status === 'tham_gia' || a.status === 'tre').length;
      return s + (attended / el);
    }, 0) / total;

    return { total, avgRate: Math.round(avgRate * 100) };
  } catch (_e) {
    return null;
  }
}

module.exports = { buildDashboard, buildDashboardStats, timKenhThongBao };
