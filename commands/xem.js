'use strict';
const { Command } = require('@sapphire/framework');

// ── Logic gốc ──────────────────────────────────────────────────────────────
// commands/xem.js
'use strict';
const { SlashCommandBuilder } = require('discord.js');
const db = require('../db.js');
const { buildSessionEmbed } = require('../utils/embeds.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('xem')
    .setDescription('Xem danh sách điểm danh phiên đang mở'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guild } = interaction;
    const session = await db.getActiveSession(guild.id);
    if (!session) return interaction.editReply({ content: '⚠️ Không có phiên nào đang mở.' });

    const attended  = await db.getAttendances(session.id);
    const cfg       = await db.getGuildConfig(guild.id);
    const embed     = await buildSessionEmbed(guild, session, attended, cfg.phai_role_ids ?? []);
    await interaction.editReply({ embeds: [embed] });
  },
};
// ── Sapphire wrapper ──────────────────────────────────────────────────────────
const _origModule = module.exports;
class XemCommand extends Command {
  constructor(context) { super(context, { name: _origModule.data.name, description: _origModule.data.description }); }
  registerApplicationCommands(registry) { registry.registerChatInputCommand(_origModule.data); }
  async chatInputRun(interaction) { return _origModule.execute(interaction); }
}
module.exports = { XemCommand };
