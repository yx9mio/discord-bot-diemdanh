// commands/xem.js — Xem phiên + nút điểm danh trực tiếp (ephemeral)
const { SlashCommandBuilder } = require('discord.js');
const db = require('../db.js');
const { buildSessionEmbed, buildAttendanceButtons, FOOTER_DEFAULT, AUTHOR_DEFAULT } = require('../utils/embeds.js');
const { EmbedBuilder } = require('discord.js');

const data = new SlashCommandBuilder()
  .setName('xem_diemdanh')
  .setDescription('Xem phiên điểm danh đang mở và điểm danh ngay tại đây');

async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const session = await db.getActiveSession(interaction.guild.id);

  if (!session) {
    const embed = new EmbedBuilder()
      .setAuthor(AUTHOR_DEFAULT)
      .setTitle('📭 Không Có Phiên Đang Mở')
      .setDescription('Hiện tại chưa có phiên điểm danh nào đang diễn ra.\nAdmin có thể mở phiên bằng `/bat_dau`.')
      .setColor(0x99AAB5)
      .setFooter({ text: FOOTER_DEFAULT })
      .setTimestamp();
    return interaction.editReply({ embeds: [embed] });
  }

  const attended = await db.getAttendances(session.id);
  const embed    = await buildSessionEmbed(interaction.guild, session, attended);

  // Kiểm tra trạng thái điểm danh hiện tại của user
  const myRecord = attended.find(a => a.user_id === interaction.user.id);
  const STATUS_LABEL = { tham_gia: '✅ Tham Gia', tre: '⏰ Đến Trễ', khong_tham_gia: '❌ Vắng Mặt' };
  const statusNote = myRecord
    ? `\n\n> 📌 Trạng thái của bạn: **${STATUS_LABEL[myRecord.status] ?? myRecord.status}**`
    : `\n\n> 👇 Bấm nút bên dưới để điểm danh ngay`;

  // Append note vào description
  const newDesc = (embed.data.description ?? '') + statusNote;
  embed.setDescription(newDesc);

  const buttons = buildAttendanceButtons(false);
  return interaction.editReply({ embeds: [embed], components: [buttons] });
}

module.exports = { data, execute };
