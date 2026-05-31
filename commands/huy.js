// commands/huy.js
const { SlashCommandBuilder } = require('discord.js');
const db = require('../db.js');
const { laAdmin } = require('../utils/helpers.js');
const { xoaHenGio } = require('../utils/timers.js');
const { voHieuHoaNutDiemDanh } = require('../utils/session.js');

const data = new SlashCommandBuilder()
  .setName('huy_diemdanh')
  .setDescription('Hủy phiên điểm danh đang mở (không lưu vào lịch sử)');

async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const guild = interaction.guild;
  const cfg   = await db.getConfig(guild.id);

  if (!laAdmin(interaction.member, cfg)) {
    return interaction.editReply({ content: '🔒 Bạn không có quyền thực hiện lệnh này.' });
  }

  const session = await db.getActiveSession(guild.id);
  if (!session) {
    return interaction.editReply({ content: '📭 Không có phiên điểm danh nào đang mở.' });
  }

  await db.cancelSession(session.id);
  xoaHenGio(guild.id);

  // Fix: dùng session.channel_id thay vì interaction.channel
  const sessionChannel = session.channel_id
    ? await guild.channels.fetch(session.channel_id).catch(() => interaction.channel)
    : interaction.channel;
  await voHieuHoaNutDiemDanh(interaction.client, sessionChannel, session);

  await interaction.editReply({
    content: `🗑️ Phiên **${session.session_name}** đã bị hủy. Phiên này sẽ không hiện trong lịch sử.`,
  });
}

module.exports = { data, execute };
