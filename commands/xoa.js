// commands/xoa.js
'use strict';
const { SlashCommandBuilder } = require('discord.js');
const db = require('../db.js');
const { replyOkEdit, replyErrEdit, buildSessionEmbed, buildAttendanceButtons } = require('../utils/embeds.js');
const { requireAdmin } = require('../utils/permissions.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('xoa')
    .setDescription('Xóa điểm danh của một thành viên (Admin)')
    .addUserOption(o =>
      o.setName('thanh_vien').setDescription('Thành viên cần xóa điểm danh').setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guild } = interaction;

    const { ok, cfg } = await requireAdmin(interaction, { context: '/xoa' });
    if (!ok) return;

    const target  = interaction.options.getUser('thanh_vien');
    const session = await db.getActiveSession(guild.id);

    if (!session) {
      return interaction.editReply(replyErrEdit('📭 Không có phiên nào đang mở.'));
    }

    try {
      await db.removeAttendance(session.id, target.id);
    } catch {
      return interaction.editReply(replyErrEdit('Có lỗi khi xóa điểm danh. Vui lòng thử lại.'));
    }

    const attended    = await db.getAttendance(session.id);
    const phaiRoleIds = cfg.phai_role_ids ?? [];
    const embed       = await buildSessionEmbed(guild, session, attended, phaiRoleIds);
    const buttons     = buildAttendanceButtons(false);

    return interaction.editReply({
      ...replyOkEdit(`Đã xóa điểm danh của <@${target.id}> khỏi phiên **${session.session_name}**.`),
      embeds: [embed],
      components: [buttons],
    });
  },
};
