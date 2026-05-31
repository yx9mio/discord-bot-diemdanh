// commands/member.js
'use strict';
const { SlashCommandBuilder } = require('discord.js');
const db = require('../db.js');
const { replyErrEdit, buildMemberEmbed } = require('../utils/embeds.js');
const { requireAdmin } = require('../utils/permissions.js');
const { buildProgressBar } = require('../utils/progress.js');
const { layHuyHieu } = require('../utils/helpers.js');

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
    if (!guildMember) {
      return interaction.editReply(replyErrEdit(`Không tìm thấy thành viên <@${target.id}> trong server.`));
    }

    const totalJoined   = stats.total_joined   ?? 0;
    const totalSessions = stats.total_sessions ?? 0;
    const pct   = totalSessions > 0 ? Math.round((totalJoined / totalSessions) * 100) : 0;
    const bar   = buildProgressBar(pct);
    const badge = layHuyHieu(totalJoined);

    return interaction.editReply({
      embeds: [buildMemberEmbed(guildMember, stats, badge, pct, bar)],
    });
  },
};
