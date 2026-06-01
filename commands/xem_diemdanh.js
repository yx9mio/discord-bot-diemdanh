'use strict';
const { Command } = require('@sapphire/framework');

// ── Logic gốc ──────────────────────────────────────────────────────────────
// commands/xem_diemdanh.js — Xem phiên hiện tại + nút điểm danh trực tiếp
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db.js');
const { buildSessionEmbed, buildAttendanceButtons } = require('../utils/embeds.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('xem_diemdanh')
    .setDescription('Xem phiên điểm danh hiện tại kèm nút điểm danh'),

  async execute(interaction) {
    await interaction.deferReply();
    const { guild } = interaction;
    const session = await db.getActiveSession(guild.id);
    if (!session) return interaction.editReply({ content: '⚠️ Không có phiên nào đang mở.' });

    const attended = await db.getAttendances(session.id);
    const cfg      = await db.getGuildConfig(guild.id);
    const embed    = await buildSessionEmbed(guild, session, attended, cfg.phai_role_ids ?? []);
    const buttons  = buildAttendanceButtons(false);

    await interaction.editReply({ embeds: [embed], components: [buttons] });
  },
};
// ── Sapphire wrapper ──────────────────────────────────────────────────────────
const _origModule = module.exports;
class XemDiemdanhCommand extends Command {
  constructor(context) { super(context, { name: _origModule.data.name, description: _origModule.data.description }); }
  registerApplicationCommands(registry) { registry.registerChatInputCommand(_origModule.data); }
  async chatInputRun(interaction) { return _origModule.execute(interaction); }
}
module.exports = { XemDiemdanhCommand };
