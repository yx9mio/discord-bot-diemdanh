// commands/resetstreak.js — Reset streak của 1 member (Admin)
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db.js');
const { laAdmin, layHuyHieu } = require('../utils/helpers.js');
const { buildProgressBar } = require('../utils/progress.js');
const { pctEmoji, pctColor, FOOTER_DEFAULT, AUTHOR_DEFAULT } = require('../utils/embeds.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resetstreak')
    .setDescription('[Admin] Reset streak của một thành viên')
    .addUserOption(o =>
      o.setName('thanh_vien')
        .setDescription('Thành viên cần reset streak')
        .setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guild, member } = interaction;

    const cfg = await db.getConfig(guild.id);
    if (!laAdmin(member, cfg)) {
      return interaction.editReply({ content: '🔒 Bạn cần quyền Admin hoặc role Admin Bot.' });
    }

    const target     = interaction.options.getUser('thanh_vien');
    const targetMem  = await guild.members.fetch(target.id).catch(() => null);
    const displayName = targetMem?.nickname ?? target.globalName ?? target.username;

    // Lấy stats trước khi reset
    const before = await db.getMemberStats(guild.id, target.id).catch(() => null);

    // Reset streak trong DB
    await db.resetMemberStreak(guild.id, target.id);

    // Lấy stats sau reset
    const after = await db.getMemberStats(guild.id, target.id).catch(() => null);
    const totalJoined   = after?.total_joined ?? 0;
    const totalSessions = after?.total_sessions ?? 1;
    const pct   = totalSessions > 0 ? Math.round((totalJoined / totalSessions) * 100) : 0;
    const bar   = buildProgressBar(pct);
    const badge = layHuyHieu(totalJoined);

    const embed = new EmbedBuilder()
      .setAuthor(AUTHOR_DEFAULT)
      .setTitle('🔄 Reset Streak Thành Công')
      .setColor(pctColor(pct))
      .setThumbnail(target.displayAvatarURL({ dynamic: true }))
      .setDescription([
        `Đã reset streak của **${displayName}**.`,
        '',
        `**Trước:** 🔥 Streak ${before?.current_streak ?? '?'} phiên`,
        `**Sau:** 🔥 Streak **0** phiên`,
        '',
        `${pctEmoji(pct)} \`${bar}\` **${pct}%** (${totalJoined}/${totalSessions})`,
        badge ? `🏅 Huy hiệu: ${badge}` : '',
      ].filter(Boolean).join('\n'))
      .addFields(
        { name: '👤 Thành viên', value: `<@${target.id}>`, inline: true },
        { name: '🔥 Streak cũ', value: `${before?.current_streak ?? 0}`, inline: true },
        { name: '🔄 Streak mới', value: '0', inline: true },
      )
      .setFooter({ text: `${FOOTER_DEFAULT} · Thực hiện bởi ${member.nickname ?? interaction.user.username}` })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  },
};
