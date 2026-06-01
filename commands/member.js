'use strict';
const { Command } = require('@sapphire/framework');

// ── Logic gốc ──────────────────────────────────────────────────────────────
// commands/member.js
'use strict';
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../db.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('member')
    .setDescription('Xem thông tin điểm danh của một thành viên')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption(o => o.setName('thanh_vien').setDescription('Thành viên cần xem').setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const target = interaction.options.getUser('thanh_vien');
    const { guild } = interaction;
    const stats = await db.getUserStats(guild.id, target.id);

    const embed = new EmbedBuilder()
      .setColor(0x01696f)
      .setTitle(`👤 Thông tin: ${target.username}`)
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        { name: '✅ Tham gia',       value: `${stats.present ?? 0}`,  inline: true },
        { name: '⏰ Trễ',           value: `${stats.late ?? 0}`,     inline: true },
        { name: '❌ Vắng',          value: `${stats.absent ?? 0}`,   inline: true },
        { name: '🔥 Streak hiện tại', value: `${stats.streak ?? 0}`, inline: true },
        { name: '🏆 Streak cao nhất', value: `${stats.best_streak ?? 0}`, inline: true },
      ).setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
// ── Sapphire wrapper ──────────────────────────────────────────────────────────
const _origModule = module.exports;
class MemberCommand extends Command {
  constructor(context) { super(context, { name: _origModule.data.name, description: _origModule.data.description, preconditions: ['AdminOnly'] }); }
  registerApplicationCommands(registry) { registry.registerChatInputCommand(_origModule.data); }
  async chatInputRun(interaction) { return _origModule.execute(interaction); }
}
module.exports = { MemberCommand };
