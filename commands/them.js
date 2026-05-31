// commands/them.js
'use strict';
const { SlashCommandBuilder } = require('discord.js');
const db = require('../db.js');
const { buildSessionEmbed, buildAttendanceButtons, replyOkEdit, replyErrEdit } = require('../utils/embeds.js');
const { requireAdmin } = require('../utils/permissions.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('them')
    .setDescription('Thêm thành viên vào điểm danh (Admin)')
    .addUserOption(o =>
      o.setName('thanh_vien').setDescription('Thành viên cần thêm').setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guild } = interaction;

    const { ok, cfg } = await requireAdmin(interaction, { context: '/them' });
    if (!ok) return;

    const target  = interaction.options.getUser('thanh_vien');
    const session = await db.getActiveSession(guild.id);

    if (!session) {
      return interaction.editReply(replyErrEdit('📭 Không có phiên điểm danh nào đang mở.'));
    }

    try {
      await db.markAttendance(session.id, target.id, interaction.user.id);
    } catch {
      return interaction.editReply(replyErrEdit('Có lỗi khi ghi điểm danh. Vui lòng thử lại.'));
    }

    const attended    = await db.getAttendance(session.id);
    const phaiRoleIds = cfg.phai_role_ids ?? [];
    const embed       = await buildSessionEmbed(guild, session, attended, phaiRoleIds);
    const buttons     = buildAttendanceButtons(false);

    return interaction.editReply({
      ...replyOkEdit(`Đã thêm <@${target.id}> vào điểm danh phiên **${session.session_name}**.`),
      embeds: [embed],
      components: [buttons],
    });
  },
};
