// commands/huy.js
'use strict';
const { SlashCommandBuilder } = require('discord.js');
const db = require('../db.js');
const { replyOkEdit, replyWarnEdit } = require('../utils/embeds.js');
const { requireAdmin } = require('../utils/permissions.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('huy')
    .setDescription('Hủy phiên điểm danh đang mở (không lưu kết quả)'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guild } = interaction;

    const { ok } = await requireAdmin(interaction, { context: '/huy' });
    if (!ok) return;

    const session = await db.getActiveSession(guild.id);
    if (!session) return interaction.editReply(replyWarnEdit('📭 Không có phiên nào đang mở.'));

    await db.cancelSession(session.id);
    return interaction.editReply(replyOkEdit('Đã hủy phiên điểm danh.'));
  },
};
