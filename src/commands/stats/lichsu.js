// src/commands/stats/lichsu.js
'use strict';
const { Command } = require('@sapphire/framework');
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../../db.js');
const { buildHistoryNavRow } = require('../../../utils/embeds.js');

const PAGE_SIZE = 10;

const DAY = ['CN','T2','T3','T4','T5','T6','T7'];
function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${DAY[d.getDay()]} ${d.toLocaleDateString('vi-VN')}`;
}

function buildHistoryEmbed(sessions, page, totalPages, scope) {
  const lines = sessions.map((s, i) => {
    const icon = s.cancelled ? '🚫' : (s.ended_at ? '✅' : '🟢');
    const tspan = fmtDate(s.ended_at ?? s.created_at);
    return `${icon} **${page * PAGE_SIZE + i + 1}.** ${s.session_name} — ${tspan}`;
  });
  return new EmbedBuilder()
    .setColor(0x006494)
    .setTitle(`📚 Lịch sử điểm danh`)
    .setDescription(lines.join('\n') || '_Trang trống_')
    .setFooter({ text: `Trang ${page + 1}/${totalPages}${scope ? ' · ' + scope : ''}` })
    .setTimestamp();
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
        .addIntegerOption(o => o.setName('so_luong').setDescription('Số phiên mỗi trang (mặc định 10)').setRequired(false).setMinValue(5).setMaxValue(25))
    );
  }

  async chatInputRun(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guild } = interaction;
    const pageSize  = interaction.options.getInteger('so_luong') ?? PAGE_SIZE;
    const all = await db.getSessionHistory(guild.id, 100);
    if (!all.length) return interaction.editReply({ content: 'Chưa có phiên nào.' });

    const totalPages = Math.max(1, Math.ceil(all.length / pageSize));
    const page       = 0;
    const slice      = all.slice(page * pageSize, (page + 1) * pageSize);
    const embed      = buildHistoryEmbed(slice, page, totalPages, `${all.length} phiên gần nhất`);
    const row        = totalPages > 1 ? buildHistoryNavRow(page + 1, totalPages) : null;

    await interaction.editReply({
      embeds: [embed],
      components: row ? [row] : [],
    });
  }
}

module.exports = { LichSuCommand, buildHistoryEmbed, PAGE_SIZE };
