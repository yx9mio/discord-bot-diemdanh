'use strict';
const { Command } = require('@sapphire/framework');

// ── Logic gốc ──────────────────────────────────────────────────────────────
// commands/thong_ke.js — Stats cá nhân (progress bar) + top 10
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db.js');

function bar(val, max, len = 12) {
  const filled = max > 0 ? Math.round((val / max) * len) : 0;
  return '█'.repeat(filled) + '░'.repeat(len - filled);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('thong_ke')
    .setDescription('Xem thống kê điểm danh cá nhân hoặc của thành viên khác')
    .addUserOption(o => o.setName('thanh_vien').setDescription('Thành viên cần xem (bỏ trống = bạn)').setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const target = interaction.options.getUser('thanh_vien') ?? interaction.user;
    const { guild } = interaction;
    const stats  = await db.getUserStats(guild.id, target.id);
    const total  = (stats.present ?? 0) + (stats.late ?? 0) + (stats.absent ?? 0);

    const embed = new EmbedBuilder()
      .setColor(0x01696f)
      .setAuthor({ name: target.username, iconURL: target.displayAvatarURL() })
      .setTitle('📊 Thống kê điểm danh')
      .addFields(
        { name: '✅ Tham gia',        value: `${stats.present ?? 0} / ${total}\n\`${bar(stats.present ?? 0, total)}\``, inline: false },
        { name: '⏰ Trễ',            value: `${stats.late ?? 0} / ${total}\n\`${bar(stats.late ?? 0, total)}\``,    inline: false },
        { name: '❌ Vắng',           value: `${stats.absent ?? 0} / ${total}\n\`${bar(stats.absent ?? 0, total)}\``, inline: false },
        { name: '🔥 Streak hiện tại', value: `${stats.streak ?? 0}`,       inline: true },
        { name: '🏆 Streak max',      value: `${stats.best_streak ?? 0}`,  inline: true },
      ).setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
// ── Sapphire wrapper ──────────────────────────────────────────────────────────
const _origModule = module.exports;
class ThongKeCommand extends Command {
  constructor(context) { super(context, { name: _origModule.data.name, description: _origModule.data.description }); }
  registerApplicationCommands(registry) { registry.registerChatInputCommand(_origModule.data); }
  async chatInputRun(interaction) { return _origModule.execute(interaction); }
}
module.exports = { ThongKeCommand };
