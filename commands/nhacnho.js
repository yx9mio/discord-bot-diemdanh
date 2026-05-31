// commands/nhacnho.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db.js');
const { laAdmin } = require('../utils/helpers.js');
const { FOOTER_DEFAULT } = require('../utils/embeds.js');

const data = new SlashCommandBuilder()
  .setName('nhac_nho')
  .setDescription('Nhắc nhở những thành viên chưa điểm danh');

async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const guild = interaction.guild;
  const cfg   = await db.getConfig(guild.id);

  if (!laAdmin(interaction.member, cfg)) {
    return interaction.editReply({ content: '🔒 Bạn không có quyền thực hiện lệnh này.' });
  }

  const session = await db.getActiveSession(guild.id);
  if (!session) {
    return interaction.editReply({ content: '🚭 Không có phiên điểm danh nào đang mở.' });
  }

  const attended     = await db.getAttendances(session.id);
  const daDiemDanh   = new Set(attended.map(a => a.user_id));
  const chuaDiemDanh = session.eligible_member_ids.filter(id => !daDiemDanh.has(id));

  if (chuaDiemDanh.length === 0) {
    return interaction.editReply({ content: '✅ Tất cả thành viên đã điểm danh!' });
  }

  const embed = new EmbedBuilder()
    .setColor(0xFEE75C)
    .setTitle('🔔 Nhắc Nhở Điểm Danh')
    .setDescription(`Phiên **${session.session_name}** — ${chuaDiemDanh.length} thành viên chưa điểm danh:\n\n${chuaDiemDanh.map(id => `<@${id}>`).join(' ')}`)
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();

  await interaction.channel.send({ embeds: [embed] });
  await interaction.editReply({ content: '✅ Đã gửi nhắc nhở.' });
}

module.exports = { data, execute };
