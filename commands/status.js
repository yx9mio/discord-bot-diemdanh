// commands/status.js — M-3: Xem trạng thái bot, DB và phiên đang mở
'use strict';
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Xem trạng thái bot, kết nối DB và các phiên điểm danh đang mở'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const t0 = Date.now();

    let dbStatus = '✅ Online';
    let dbPing   = 0;
    let sessions = [];

    try {
      const q0 = Date.now();
      sessions = await db.getAllActiveSessions();
      sessions = sessions.filter(s => s.guild_id === interaction.guildId);
      dbPing   = Date.now() - q0;
    } catch (e) {
      dbStatus = `❌ ${e.message.slice(0, 80)}`;
    }

    const botPing = interaction.client.ws.ping;
    const uptime  = process.uptime();
    const memMb   = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
    const guilds  = interaction.client.guilds.cache.size;
    const ok      = dbStatus.startsWith('✅');

    const embed = new EmbedBuilder()
      .setTitle('📊 Trạng thái Bot')
      .setColor(ok ? 0x01696f : 0xa12c7b)
      .addFields(
        {
          name: '🤖 Bot',
          value: [
            `**Ping WS:** ${botPing < 0 ? 'N/A' : botPing + 'ms'}`,
            `**Uptime:** ${fmtUptime(uptime)}`,
            `**RAM:** ${memMb} MB`,
            `**Servers:** ${guilds}`,
          ].join('\n'),
          inline: true,
        },
        {
          name: '🗄️ Database',
          value: [
            `**Status:** ${dbStatus}`,
            dbPing > 0 ? `**Ping:** ${dbPing}ms` : '',
          ].filter(Boolean).join('\n'),
          inline: true,
        },
        {
          name: `📋 Phiên đang mở (${sessions.length})`,
          value: sessions.length
            ? sessions.map(s =>
                `• **${s.session_name}**${s.channel_id ? ` — <#${s.channel_id}>` : ''}`
              ).join('\n').slice(0, 900)
            : '_Không có phiên nào đang mở_',
          inline: false,
        },
      )
      .setFooter({ text: `Phản hồi: ${Date.now() - t0}ms` })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  },
};

function fmtUptime(sec) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return [d && `${d}d`, h && `${h}h`, m && `${m}m`, `${s}s`].filter(Boolean).join(' ');
}
