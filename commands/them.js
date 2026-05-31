// commands/them.js
const { SlashCommandBuilder } = require('discord.js');
const db = require('../db.js');
const { buildSessionEmbed, buildAttendanceButtons } = require('../utils/embeds.js');
const { laAdmin } = require('../utils/helpers.js');

const data = new SlashCommandBuilder()
  .setName('them_diemdanh')
  .setDescription('Thêm thành viên vào điểm danh thủ công')
  .addUserOption(o => o.setName('thanh_vien').setDescription('Thành viên cần thêm').setRequired(true))
  .addStringOption(o =>
    o.setName('trang_thai')
      .setDescription('Trạng thái')
      .addChoices(
        { name: '✅ Tham Gia', value: 'tham_gia' },
        { name: '⏰ Đến Trễ',  value: 'tre' },
        { name: '❌ Vắng Mặt', value: 'khong_tham_gia' },
      )
  );

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

  const target  = interaction.options.getUser('thanh_vien');
  const status  = interaction.options.getString('trang_thai') ?? 'tham_gia';
  const member  = await guild.members.fetch(target.id).catch(() => null);
  const displayName = member?.displayName ?? target.username;

  await db.upsertAttendance(session.id, guild.id, target.id, displayName, status);

  const labelMap = { tham_gia: '✅ Tham Gia', tre: '⏰ Đến Trễ', khong_tham_gia: '❌ Vắng Mặt' };
  await interaction.editReply({ content: `✅ Đã ghi nhận **${displayName}** — ${labelMap[status]}.` });

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
