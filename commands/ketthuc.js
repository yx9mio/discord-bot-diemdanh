// commands/ketthuc.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db.js');
const { buildSummaryEmbed, FOOTER_DEFAULT } = require('../utils/embeds.js');
const { laAdmin } = require('../utils/helpers.js');
const { xoaHenGio } = require('../utils/timers.js');
const { ketThucPhien, thongBaoHuyHieu, voHieuHoaNutDiemDanh } = require('../utils/session.js');

const data = new SlashCommandBuilder()
  .setName('ket_thuc')
  .setDescription('Kết thúc phiên điểm danh đang mở');

async function execute(interaction) {
  await interaction.deferReply();
  const guild = interaction.guild;
  const cfg   = await db.getConfig(guild.id);

  if (!laAdmin(interaction.member, cfg)) {
    return interaction.editReply({ content: '🔒 Bạn không có quyền thực hiện lệnh này.' });
  }

  const session = await db.getActiveSession(guild.id);
  if (!session) {
    return interaction.editReply({ content: '📭 Không có phiên điểm danh nào đang mở.' });
  }

  const attended = await db.getAttendances(session.id);
  await ketThucPhien(guild, session, attended);
  xoaHenGio(guild.id);

  // Fix: dùng session.channel_id thay vì interaction.channel
  const sessionChannel = session.channel_id
    ? await guild.channels.fetch(session.channel_id).catch(() => interaction.channel)
    : interaction.channel;
  await voHieuHoaNutDiemDanh(interaction.client, sessionChannel, session);

  const summaryEmbed = buildSummaryEmbed(session, attended);
  const thongBao = new EmbedBuilder()
    .setColor(0x99AAB5)
    .setDescription('🔒 Phiên điểm danh đã kết thúc.')
    .setFooter({ text: FOOTER_DEFAULT });

  await interaction.editReply({ embeds: [thongBao, summaryEmbed] });
  await thongBaoHuyHieu(guild, interaction.channel, guild.id, session.id, attended);
}

module.exports = { data, execute };
