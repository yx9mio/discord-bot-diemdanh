'use strict';
const { Command } = require('@sapphire/framework');

// ── Logic gốc ──────────────────────────────────────────────────────────────
// commands/lichsu.js
// Sync với design system embeds.js — dùng AUTHOR_DEFAULT, COLOR_PRIMARY
'use strict';
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db.js');

const DAY = ['CN','T2','T3','T4','T5','T6','T7'];
function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${DAY[d.getDay()]} ${d.toLocaleDateString('vi-VN')}`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lichsu')
    .setDescription('Xem lịch sử phiên điểm danh gần đây')
    .addIntegerOption(o => o.setName('so_luong').setDescription('Số phiên hiển thị (mặc định 10)').setRequired(false).setMinValue(1).setMaxValue(25)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guild } = interaction;
    const limit = interaction.options.getInteger('so_luong') ?? 10;
    const sessions = await db.getSessionHistory(guild.id, { limit, offset: 0 });

    if (!sessions.length)
      return interaction.editReply({ content: 'Chưa có phiên nào kết thúc.' });

    const lines = sessions.map((s, i) => {
      const icon = s.cancelled ? '🚫' : '✅';
      return `${icon} **${i+1}.** ${s.session_name} — ${fmtDate(s.ended_at ?? s.created_at)}`;
    });

    const embed = new EmbedBuilder()
      .setColor(0x006494)
      .setTitle(`📚 Lịch sử ${sessions.length} phiên gần nhất`)
      .setDescription(lines.join('\n'))
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
// ── Sapphire wrapper ──────────────────────────────────────────────────────────
const _origModule = module.exports;
class LichsuCommand extends Command {
  constructor(context) { super(context, { name: _origModule.data.name, description: _origModule.data.description }); }
  registerApplicationCommands(registry) { registry.registerChatInputCommand(_origModule.data); }
  async chatInputRun(interaction) { return _origModule.execute(interaction); }
}
module.exports = { LichsuCommand };
