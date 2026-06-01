'use strict';
const { Command } = require('@sapphire/framework');

// ── Logic gốc ──────────────────────────────────────────────────────────────
// commands/resetstreak.js
'use strict';
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../db.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resetstreak')
    .setDescription('Reset streak của một hoặc tất cả thành viên (Admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s
      .setName('thanh_vien')
      .setDescription('Reset streak của một thành viên')
      .addUserOption(o => o.setName('user').setDescription('Thành viên').setRequired(true))
    )
    .addSubcommand(s => s.setName('tat_ca').setDescription('Reset streak toàn bộ server (⚠️ không hoàn tác)')),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const sub = interaction.options.getSubcommand();
    const { guild } = interaction;

    if (sub === 'thanh_vien') {
      const user = interaction.options.getUser('user');
      await db.resetStreak(guild.id, user.id);
      return interaction.editReply({ content: `✅ Đã reset streak của <@${user.id}>.` });
    }
    if (sub === 'tat_ca') {
      await db.resetAllStreaks(guild.id);
      const embed = new EmbedBuilder().setColor(0xa12c7b).setTitle('⚠️ Reset Streak Toàn Server').setDescription('Đã reset streak toàn bộ thành viên.').setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    }
  },
};
// ── Sapphire wrapper ──────────────────────────────────────────────────────────
const _origModule = module.exports;
class ResetstreakCommand extends Command {
  constructor(context) { super(context, { name: _origModule.data.name, description: _origModule.data.description, preconditions: ['AdminOnly'] }); }
  registerApplicationCommands(registry) { registry.registerChatInputCommand(_origModule.data); }
  async chatInputRun(interaction) { return _origModule.execute(interaction); }
}
module.exports = { ResetstreakCommand };
