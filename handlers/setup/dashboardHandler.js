// handlers/setup/dashboardHandler.js — buildDashboard + buildDashboardStats
'use strict';
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../db.js');
const { FOOTER_DEFAULT, AUTHOR_DEFAULT } = require('../../utils/embeds.js');
const { TEN_THU, pad, ngayThucTe } = require('./helpers.js');

async function timKenhThongBao(guild) {
  try {
    const cfg = await db.getConfig(guild.id);
    const chId = cfg?.notification_channel_id ?? cfg?.channel_id;
    if (!chId) return null;
    const ch = guild.channels.cache.get(chId) ?? await guild.channels.fetch(chId).catch(() => null);
    return ch?.id ?? null;
  } catch { return null; }
}

async function buildDashboardStats(guildId) {
  const [activeSession, history, allMemberStats] = await Promise.all([
    db.getActiveSession(guildId),
    db.getSessionHistory(guildId, 10),
    db.getAllMemberStats(guildId),
  ]);
  const totalSessions = history.length;
  const lastSession   = history[0] ?? null;
  const totalMembers  = allMemberStats.length;
  const avgAttendance = totalMembers > 0
    ? Math.round(allMemberStats.reduce((s, m) => s + (m.total_joined ?? 0), 0) / totalMembers)
    : 0;
  const topMember = allMemberStats[0] ?? null;
  return { activeSession, lastSession, totalSessions, totalMembers, avgAttendance, topMember };
}

async function buildDashboard(guild, cfg, viewMode = 'admin') {
  const notifCh  = await timKenhThongBao(guild);
  const lichList = await db.getLichCoDinh(guild.id);

  const lichLines = lichList.length
    ? lichList.map((l, i) => {
        const mo   = `${TEN_THU[l.day_of_week]} ${pad(l.hour)}:${pad(l.minute)}`;
        const dong = l.close_day_of_week != null
          ? `${TEN_THU[l.close_day_of_week]} ${pad(l.close_hour)}:${pad(l.close_minute)}`
          : 'không tự đóng';
        return `\`${i+1}\` **${l.session_name}** | ${mo} → ${dong} | <#${l.channel_id}>`;
      }).join('\n')
    : '⚠️ Chưa có lịch cố định';

  if (viewMode === 'user') {
    const embed = new EmbedBuilder()
      .setAuthor(AUTHOR_DEFAULT)
      .setTitle('📋  Thông tin Bot')
      .setDescription('> Chế độ xem thành viên — chỉ hiển thị thông tin cơ bản.')
      .addFields(
        { name: '🔔 Kênh thông báo', value: notifCh ? `<#${notifCh}>` : '_Chưa rõ_', inline: true },
        { name: '🎫 Role điểm danh', value: cfg.allowed_role_id ? `<@&${cfg.allowed_role_id}>` : '⚠️ Chưa cài', inline: true },
        { name: `📅 Lịch cố định (${lichList.length})`, value: lichLines },
      )
      .setColor(0x5865F2)
      .setFooter({ text: `${FOOTER_DEFAULT} • Chế độ xem: Thành viên` })
      .setTimestamp();
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('setup:view:admin').setLabel('🛡️ Chuyển sang Admin View').setStyle(ButtonStyle.Secondary),
    );
    return { embeds: [embed], components: [row], ephemeral: true };
  }

  const stats = await buildDashboardStats(guild.id);
  const phaiRoleIds = cfg.phai_role_ids ?? [];
  const phaiLines   = phaiRoleIds.length ? phaiRoleIds.map(id => `<@&${id}>`).join(', ') : '⚠️ Chưa cài';

  let phienHienTai;
  if (stats.activeSession) {
    const startedAt = stats.activeSession.created_at
      ? `<t:${Math.floor(new Date(stats.activeSession.created_at).getTime() / 1000)}:R>`
      : '';
    phienHienTai = `🟢 **${stats.activeSession.session_name}** đang mở ${startedAt} | <#${stats.activeSession.channel_id ?? notifCh ?? '?'}>`;
  } else {
    phienHienTai = '⚫ Không có phiên đang mở';
  }

  let phienGanNhat;
  if (stats.lastSession) {
    const endedAt = stats.lastSession.ended_at
      ? `<t:${Math.floor(new Date(stats.lastSession.ended_at).getTime() / 1000)}:d>`
      : '';
    phienGanNhat = `**${stats.lastSession.session_name}** — ${endedAt}`;
  } else {
    phienGanNhat = '_Chưa có phiên nào_';
  }

  const topLine = stats.topMember
    ? `<@${stats.topMember.user_id}> — ${stats.topMember.total_joined}/${stats.topMember.total_sessions} phiên`
    : '_Chưa có dữ liệu_';

  const embed = new EmbedBuilder()
    .setAuthor(AUTHOR_DEFAULT)
    .setTitle('⚙️  Bảng Điều Khiển — Quản Gia')
    .addFields(
      { name: '🔔 Kênh thông báo', value: notifCh ? `<#${notifCh}>` : '⚠️ Chưa cài', inline: true },
      { name: '🎫 Role điểm danh', value: cfg.allowed_role_id ? `<@&${cfg.allowed_role_id}>` : '⚠️ Chưa cài', inline: true },
      { name: '⚔️ Role phái', value: phaiLines, inline: true },
      { name: '📊 Thống kê nhanh', value: [
          `▸ Phiên đã lưu: **${stats.totalSessions}**`,
          `▸ Thành viên theo dõi: **${stats.totalMembers}**`,
          `▸ Trung bình điểm danh: **${stats.avgAttendance}** phiên/người`,
        ].join('\n'), inline: false },
      { name: '🟢 Phiên hiện tại', value: phienHienTai, inline: false },
      { name: '🕐 Phiên gần nhất', value: phienGanNhat, inline: true },
      { name: '🏆 Điểm danh nhiều nhất', value: topLine, inline: true },
      { name: `📅 Lịch cố định (${lichList.length})`, value: lichLines },
    )
    .setColor(stats.activeSession ? 0x57F287 : 0x5865F2)
    .setFooter({ text: `${FOOTER_DEFAULT} • Chế độ xem: Admin` })
    .setTimestamp();

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('setup:channel').setLabel('🔔 Kênh TB').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('setup:role').setLabel('🎫 Role DD').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('setup:phai').setLabel('⚔️ Role Phái').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('setup:view:user').setLabel('👁️ User View').setStyle(ButtonStyle.Secondary),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('setup:lich:menu').setLabel('📅 Quản lý Lịch').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('setup:preset_menu').setLabel('⚡ Tạo Preset').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('setup:dashboard').setLabel('🔄 Làm mới').setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row1, row2], ephemeral: true };
}

module.exports = { buildDashboard, timKenhThongBao };
