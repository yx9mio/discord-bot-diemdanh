// commands/ketthuc.js
'use strict';
const { SlashCommandBuilder } = require('discord.js');
const db = require('../db.js');
const { buildSummaryEmbed, replyOkEdit, replyWarnEdit } = require('../utils/embeds.js');
const { requireAdmin } = require('../utils/permissions.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ket_thuc')
    .setDescription('Kết thúc phiên điểm danh đang mở'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guild } = interaction;

    const { ok, cfg } = await requireAdmin(interaction, { context: '/ket_thuc' });
    if (!ok) return;

    const session = await db.getActiveSession(guild.id);
    if (!session) return interaction.editReply(replyWarnEdit('📭 Không có phiên nào đang mở.'));

    await db.closeSession(session.id);

    const attended    = await db.getAttendance(session.id);
    const phaiRoleIds = cfg.phai_role_ids?.length ? cfg.phai_role_ids : null;
    const embed       = await buildSummaryEmbed(guild, session, attended, phaiRoleIds);

    return interaction.editReply({ ...replyOkEdit('Đã kết thúc phiên điểm danh.'), embeds: [embed] });
  },
};
