// utils/_views/attendView.js
// [FIX] Implement đúng signature theo attendanceHandler.js:
//   buildAttendConfirmEmbed(member, status, sessionName, streak)
// [BUG] Trước đây trả về raw EmbedBuilder → interaction.editReply(embed) bị Discord reject
//       vì editReply cần { embeds: [...] } không phải EmbedBuilder trực tiếp
'use strict';
const { EmbedBuilder, MessageFlags } = require('discord.js');

const STATUS_LABEL = {
  tham_gia:       '✅ Tham gia',
  tre:            '⏰ Trễ',
  khong_tham_gia: '❌ Vắng',
  co_phep:        '🟡 Có phép',
};

const STATUS_COLOR = {
  tham_gia:       0x57f287,  // GREEN
  tre:            0xf0a500,  // ORANGE
  khong_tham_gia: 0xff4444,  // RED
  co_phep:        0xfee75c,  // YELLOW
};

/**
 * @param {import('discord.js').GuildMember} member
 * @param {'tham_gia'|'tre'|'khong_tham_gia'|'co_phep'} status
 * @param {string} sessionName
 * @param {number} streak
 * @returns {{ embeds: EmbedBuilder[], flags: number }}
 */
function buildAttendConfirmEmbed(member, status, sessionName, streak = 0) {
  const label = STATUS_LABEL[status] ?? status;
  const color = STATUS_COLOR[status] ?? 0x5865f2;
  const displayName = member?.nickname ?? member?.user?.displayName ?? member?.user?.username ?? 'Bạn';

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`${label}`)
    .setDescription(`**${displayName}** đã điểm danh phần **${sessionName}**`)
    .setTimestamp();

  if (streak > 0) {
    embed.setFooter({ text: `🔥 Streak hiện tại: ${streak} buổi liên tiếp` });
  }

  return { embeds: [embed], flags: MessageFlags.Ephemeral };
}

/**
 * @returns {{ embeds: EmbedBuilder[], flags: number }}
 */
function buildAdminOverrideSuccessEmbed(targetUsername, status, sessionName) {
  const label = STATUS_LABEL[status] ?? status;
  const embed = new EmbedBuilder()
    .setColor(0xf0a500)
    .setTitle('🔧 Admin đã cập nhật điểm danh')
    .setDescription(`Đã điểm danh cho **${targetUsername ?? 'user'}**: ${label}\nPhiên: **${sessionName ?? ''}**`)
    .setTimestamp();

  return { embeds: [embed], flags: MessageFlags.Ephemeral };
}

module.exports = { buildAttendConfirmEmbed, buildAdminOverrideSuccessEmbed };
