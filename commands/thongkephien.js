'use strict';
const { Command } = require('@sapphire/framework');

// ── Logic gốc ──────────────────────────────────────────────────────────────
// commands/thongkephien.js
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../db.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('thongkephien')
    .setDescription('Thống kê chi tiết một phiên điểm danh (Admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o => o.setName('phien_id').setDescription('ID phiên (bỏ trống = phiên hiện tại)').setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guild } = interaction;
    const sessionId = interaction.options.getString('phien_id');
    const session   = sessionId ? await db.getSessionByIdRaw(sessionId, guild.id) : await db.getActiveSession(guild.id);
    if (!session) return interaction.editReply({ content: '⚠️ Không tìm thấy phiên.' });

    const attendances = await db.getAttendances(session.id);
    const counts = { tham_gia: 0, khong_tham_gia: 0, tre: 0, co_phep: 0 };
    for (const a of attendances) counts[a.status] = (counts[a.status] ?? 0) + 1;

    const embed = new EmbedBuilder()
      .setColor(0x01696f)
      .setTitle(`📋 Thống kê phiên: ${session.session_name}`)
      .addFields(
        { name: '✅ Tham gia',  value: `${counts.tham_gia}`,         inline: true },
        { name: '⏰ Trễ',      value: `${counts.tre}`,              inline: true },
        { name: '❌ Vắng',     value: `${counts.khong_tham_gia}`,   inline: true },
        { name: '🟡 Có phép',  value: `${counts.co_phep}`,          inline: true },
        { name: '📊 Tổng',     value: `${attendances.length}`,      inline: true },
      ).setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
// ── Sapphire wrapper ──────────────────────────────────────────────────────────
const _origModule = module.exports;
class ThongkephienCommand extends Command {
  constructor(context) { super(context, { name: _origModule.data.name, description: _origModule.data.description, preconditions: ['AdminOnly'] }); }
  registerApplicationCommands(registry) { registry.registerChatInputCommand(_origModule.data); }
  async chatInputRun(interaction) { return _origModule.execute(interaction); }
}
module.exports = { ThongkephienCommand };
