// commands/xoa.js
const { SlashCommandBuilder } = require('discord.js');
const db = require('../db.js');
const { buildSessionEmbed, buildAttendanceButtons } = require('../utils/embeds.js');
const { laAdmin } = require('../utils/helpers.js');

const data = new SlashCommandBuilder()
  .setName('xoa_diemdanh')
  .setDescription('Xóa điểm danh của một thành viên khỏi phiên đang mở')
  .addUserOption(o => o.setName('thanh_vien').setDescription('Thành viên cần xóa').setRequired(true));

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

  const target = interaction.options.getUser('thanh_vien');
  await db.removeAttendance(session.id, target.id);
  await interaction.editReply({ content: `🗑️ Đã xóa điểm danh của **${target.username}**.` });

  // Cập nhật embed gốc
  try {
    const channel = interaction.channel;
    if (session.message_id) {
      const msg = await channel.messages.fetch(session.message_id).catch(() => null);
      if (msg) {
        const attended = await db.getAttendances(session.id);
        const embed = await buildSessionEmbed(guild, session, attended);
        await msg.edit({ embeds: [embed], components: [buildAttendanceButtons(false)] });
      }
    }
  } catch (_) {}
}

module.exports = { data, execute };
