// commands/resetstreak.js
'use strict';
const { SlashCommandBuilder } = require('discord.js');
const db = require('../db.js');
const { replyOkEdit, replyErrEdit } = require('../utils/embeds.js');
const { requireAdmin } = require('../utils/permissions.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reset_streak')
    .setDescription('[Admin] Reset streak điểm danh của một thành viên')
    .setDefaultMemberPermissions(0n)
    .addUserOption(o =>
      o.setName('thanh_vien').setDescription('Thành viên cần reset streak').setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const { ok } = await requireAdmin(interaction, { context: '/reset_streak' });
    if (!ok) return;

    const target = interaction.options.getUser('thanh_vien');
    await db.resetMemberStreak(interaction.guild.id, target.id);

    return interaction.editReply(
      replyOkEdit(`Đã reset streak của <@${target.id}> về 0.`)
    );
  },
};
