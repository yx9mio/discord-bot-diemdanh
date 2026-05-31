// commands/member.js
'use strict';
const { SlashCommandBuilder } = require('discord.js');
const db = require('../db.js');
const { replyErrEdit, buildMemberEmbed } = require('../utils/embeds.js');
const { requireAdmin } = require('../utils/permissions.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('member')
    .setDescription('[Admin] Xem thông tin điểm danh của một thành viên')
    .setDefaultMemberPermissions(0n)
    .addUserOption(o =>
      o.setName('thanh_vien').setDescription('Thành viên cần xem').setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guild } = interaction;

    const { ok } = await requireAdmin(interaction, { context: '/member' });
    if (!ok) return;

    const target = interaction.options.getUser('thanh_vien');
    const stats  = await db.getMemberStats(guild.id, target.id);

    if (!stats) {
      return interaction.editReply(replyErrEdit(`Không tìm thấy dữ liệu cho <@${target.id}>.`));
    }

    const guildMember = await guild.members.fetch(target.id).catch(() => null);
    const displayName = guildMember?.nickname ?? target.globalName ?? target.username;

    return interaction.editReply({
      embeds: [buildMemberEmbed(target, displayName, stats)],
    });
  },
};
