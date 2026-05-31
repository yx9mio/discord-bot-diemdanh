// commands/xoa.js
'use strict';
const { SlashCommandBuilder } = require('discord.js');
const db = require('../db.js');
const { laAdmin } = require('../utils/helpers.js');
const { replyOkEdit, replyErrEdit, buildSessionEmbed, buildAttendanceButtons } = require('../utils/embeds.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('xoa')
    .setDescription('[Admin] Xóa điểm danh của một thành viên khỏi phiên hiện tại')
    .setDefaultMemberPermissions(0n)
    .addUserOption(o =>
      o.setName('thanh_vien').setDescription('Thành viên cần xóa').setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guild, member } = interaction;

    const cfg = await db.getConfig(guild.id);
    if (!laAdmin(member, cfg)) {
      return interaction.editReply(replyErrEdit('🔒 Bạn không có quyền dùng lệnh này.'));
    }

    const session = await db.getActiveSession(guild.id);
    if (!session) {
      return interaction.editReply(replyErrEdit('📭 Không có phiên nào đang mở.'));
    }

    const target = interaction.options.getUser('thanh_vien');

    try {
      await db.removeAttendance(session.id, target.id);
    } catch (err) {
      console.error('[xoa] Lỗi removeAttendance:', err);
      return interaction.editReply(replyErrEdit('Có lỗi khi xóa điểm danh. Vui lòng thử lại.'));
    }

    // Cập nhật embed gốc
    try {
      if (session.message_id) {
        const channel = interaction.channel;
        const msg = await channel.messages.fetch(session.message_id).catch(() => null);
        if (msg) {
          const attended = await db.getAttendances(session.id);
          const embed = await buildSessionEmbed(guild, session, attended);
          await msg.edit({ embeds: [embed], components: [buildAttendanceButtons(false)] });
        }
      }
    } catch (_) {}

    return interaction.editReply(replyOkEdit(`Đã xóa điểm danh của <@${target.id}> khỏi phiên **${session.session_name}**.`));
  },
};
