// src/commands/stats/lichsu.js
'use strict';
const { Command } = require('@sapphire/framework');
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../db.js');

const DAY = ['CN','T2','T3','T4','T5','T6','T7'];
function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${DAY[d.getDay()]} ${d.toLocaleDateString('vi-VN')}`;
}

class LichSuCommand extends Command {
  constructor(context) {
    super(context, { name: 'lichsu', description: 'Xem lịch sử phiên điểm danh gần đây' });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand(
      new SlashCommandBuilder()
        .setName('lichsu')
        .setDescription('Xem lịch sử phiên điểm danh gần đây')
        .addIntegerOption(o => o.setName('so_luong').setDescription('Số phiên (mặc định 10)').setRequired(false).setMinValue(1).setMaxValue(25))
    );
  }

  async chatInputRun(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guild } = interaction;
    const limit    = interaction.options.getInteger('so_luong') ?? 10;
    const sessions = await db.getSessionHistory(guild.id, { limit, offset: 0 });

    if (!sessions.length) return interaction.editReply({ content: 'Chưa có phiên nào kết thúc.' });

    const lines = sessions.map((s, i) => {
      const icon = s.cancelled ? '🚫' : '✅';
      return `${icon} **${i + 1}.** ${s.session_name} — ${fmtDate(s.ended_at ?? s.created_at)}`;
    });

    const embed = new EmbedBuilder()
      .setColor(0x006494)
      .setTitle(`📚 Lịch sử ${sessions.length} phiên gần nhất`)
      .setDescription(lines.join('\n'))
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}

module.exports = { LichSuCommand };
