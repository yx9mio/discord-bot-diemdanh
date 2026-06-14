'use strict';
const { EmbedBuilder, MessageFlags } = require('discord.js');
const { STATUS_CONFIG, statusFull } = require('../design-tokens');

function buildAttendConfirmEmbed(member, status, sessionName, streak = 0) {
  const sc = STATUS_CONFIG[status];
  const label = sc ? `${sc.emoji} ${sc.label}` : `❓ ${status}`;
  const color = sc?.color ?? 0x5865f2;
  const displayName = member?.nickname ?? member?.user?.displayName ?? member?.user?.username ?? 'Bạn';

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(label)
    .setDescription(`**${displayName}** đã điểm danh phần **${sessionName}**`)
    .setTimestamp();

  if (streak > 0) {
    embed.setFooter({ text: `🔥 Streak hiện tại: ${streak} buổi liên tiếp` });
  }

  return { embeds: [embed], flags: MessageFlags.Ephemeral };
}

function buildAdminOverrideSuccessEmbed(targetUsername, status, sessionName) {
  const label = statusFull(status);
  const embed = new EmbedBuilder()
    .setColor(0xf0a500)
    .setTitle('🔧 Admin đã cập nhật điểm danh')
    .setDescription(`Đã điểm danh cho **${targetUsername ?? 'user'}**: ${label}\nPhiên: **${sessionName ?? ''}**`)
    .setTimestamp();

  return { embeds: [embed], flags: MessageFlags.Ephemeral };
}

module.exports = { buildAttendConfirmEmbed, buildAdminOverrideSuccessEmbed };
