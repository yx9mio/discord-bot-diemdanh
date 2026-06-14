'use strict';
const { EmbedBuilder } = require('discord.js');
const { STATUS_CONFIG, statusFull } = require('../design-tokens');

function buildAttendConfirmEmbed(member, status, sessionName, streak = 0, sessionTotal = 0, sessionJoined = 0) {
  const sc = STATUS_CONFIG[status];
  const label = sc ? `${sc.emoji} ${sc.label}` : `❓ ${status}`;
  const baseColor = sc?.color ?? 0x5865f2;

  // Color gradient by streak
  const color = streak >= 10 ? 0xFFD700
    : streak >= 5  ? 0x57f287
    : streak >= 3  ? 0xfee75c
    : baseColor;

  const displayName = member?.nickname ?? member?.user?.displayName ?? member?.user?.username ?? 'Bạn';

  const descParts = [
    `**${displayName}** đã điểm danh phần **${sessionName}**`,
  ];
  if (sessionTotal > 0) {
    const pct = Math.round(sessionJoined / sessionTotal * 100);
    descParts.push(`📊 Tỷ lệ phiên: **${sessionJoined}/${sessionTotal}** (${pct}%)`);
  }

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(label)
    .setDescription(descParts.join('\n'))
    .setTimestamp();

  if (streak > 0) {
    embed.setFooter({ text: `🔥 Streak hiện tại: ${streak} buổi liên tiếp` });
  }

  return { embeds: [embed] };
}

function buildAdminOverrideSuccessEmbed(targetUsername, status, sessionName) {
  const label = statusFull(status);
  const embed = new EmbedBuilder()
    .setColor(0xf0a500)
    .setTitle('🔧 Admin đã cập nhật điểm danh')
    .setDescription(`Đã điểm danh cho **${targetUsername ?? 'user'}**: ${label}\nPhiên: **${sessionName ?? ''}**`)
    .setTimestamp();

  return { embeds: [embed] };
}

module.exports = { buildAttendConfirmEmbed, buildAdminOverrideSuccessEmbed };
