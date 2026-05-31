// commands/sua.js
const { SlashCommandBuilder } = require('discord.js');
const db = require('../db.js');
const { laAdmin } = require('../utils/helpers.js');

const STATUS_MAP = {
  'tham_gia':       'tham_gia',
  'tre':            'tre',
  'khong_tham_gia': 'khong_tham_gia',
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sua')
    .setDescription('[Admin] Sửa trạng thái điểm danh của một thành viên')
    .setDefaultMemberPermissions(0n)
    .addUserOption(o =>
      o.setName('thanh_vien').setDescription('Thành viên cần sửa').setRequired(true)
    )
    .addStringOption(o =>
      o.setName('trang_thai').setDescription('Trạng thái mới').setRequired(true)
        .addChoices(
          { name: '✅ Tham gia', value: 'tham_gia' },
          { name: '⏰ Đến trễ', value: 'tre' },
          { name: '❌ Vắng mặt', value: 'khong_tham_gia' },
        )
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guild, member } = interaction;
    const cfg = await db.getConfig(guild.id);
    if (!laAdmin(member, cfg)) {
      return interaction.editReply({ content: '🔒 Bạn không có quyền dùng lệnh này.' });
    }

    const session = await db.getActiveSession(guild.id);
    if (!session) return interaction.editReply({ content: '📭 Không có phiên nào đang mở.' });

    const target    = interaction.options.getUser('thanh_vien');
    const status    = interaction.options.getString('trang_thai');
    const guildMember = await guild.members.fetch(target.id).catch(() => null);
    const displayName = guildMember?.nickname ?? target.globalName ?? target.username;

    await db.upsertAttendanceNoTime(session.id, guild.id, target.id, displayName, status);
    return interaction.editReply({ content: `✅ Đã cập nhật trạng thái <@${target.id}> thành **${status}**.` });
  },
};
