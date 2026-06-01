'use strict';
const { Command } = require('@sapphire/framework');

// ── Logic gốc ──────────────────────────────────────────────────────────────
// commands/thongke_server.js — /thongke_server — Stats toàn server
'use strict';
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../db.js');

function bar(val, max, len = 10) {
  const f = max > 0 ? Math.round((val / max) * len) : 0;
  return '█'.repeat(f) + '░'.repeat(len - f);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('thongke_server')
    .setDescription('Xem thống kê điểm danh toàn server (Admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guild } = interaction;
    const stats = await db.getServerStats(guild.id);

    const total = (stats.total_present ?? 0) + (stats.total_late ?? 0) + (stats.total_absent ?? 0);
    const embed = new EmbedBuilder()
      .setColor(0x01696f)
      .setTitle(`📈 Thống kê Server: ${guild.name}`)
      .addFields(
        { name: '📅 Tổng phiên',    value: `${stats.total_sessions ?? 0}`, inline: true },
        { name: '👥 Tổng lượt ĐD',  value: `${total}`,                    inline: true },
        { name: '✅ Tham gia',      value: `${stats.total_present ?? 0}\n\`${bar(stats.total_present ?? 0, total)}\``, inline: false },
        { name: '⏰ Trễ',          value: `${stats.total_late ?? 0}\n\`${bar(stats.total_late ?? 0, total)}\``,    inline: false },
        { name: '❌ Vắng',         value: `${stats.total_absent ?? 0}\n\`${bar(stats.total_absent ?? 0, total)}\``, inline: false },
      ).setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
// ── Sapphire wrapper ──────────────────────────────────────────────────────────
const _origModule = module.exports;
class ThongkeServerCommand extends Command {
  constructor(context) { super(context, { name: _origModule.data.name, description: _origModule.data.description, preconditions: ['AdminOnly'] }); }
  registerApplicationCommands(registry) { registry.registerChatInputCommand(_origModule.data); }
  async chatInputRun(interaction) { return _origModule.execute(interaction); }
}
module.exports = { ThongkeServerCommand };
