// src/commands/stats/thongkephien.js
'use strict';
const { Command } = require('@sapphire/framework');
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../db.js');

const STATUS_EMOJI = { tham_gia: '✅', khong_tham_gia: '❌', tre: '⏰', co_phep: '🟡' };

class ThongKePhienCommand extends Command {
  constructor(context) {
    super(context, { name: 'thongkephien', description: 'Xem thống kê chi tiết một phiên cụ thể', preconditions: ['AdminOnly'] });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand(
      new SlashCommandBuilder()
        .setName('thongkephien')
        .setDescription('Xem thống kê chi tiết một phiên cụ thể')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addStringOption(o => o.setName('session_id').setDescription('ID phiên (bỏ trống = phiên mới nhất)').setRequired(false))
    );
  }

  async chatInputRun(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guild } = interaction;
    const sessionId = interaction.options.getString('session_id');

    let session;
    if (sessionId) {
      session = await db.getSessionById(sessionId);
    } else {
      const history = await db.getSessionHistory(guild.id, { limit: 1, offset: 0 });
      session = history[0];
    }

    if (!session) return interaction.editReply({ content: '⚠️ Không tìm thấy phiên.' });

    const attendances = await db.getAttendances(session.id);
    const groups = { tham_gia: [], tre: [], co_phep: [], khong_tham_gia: [] };
    for (const a of attendances) {
      if (groups[a.status]) groups[a.status].push(a.user_id);
    }

    const fields = Object.entries(groups).map(([status, uids]) => ({
      name: `${STATUS_EMOJI[status]} ${status.replace(/_/g,' ')} (${uids.length})`,
      value: uids.length ? uids.map(id => `<@${id}>`).join(', ') : '_Không có_',
      inline: false,
    }));

    const embed = new EmbedBuilder()
      .setColor(0x006494)
      .setTitle(`📋 Chi tiết phiên — ${session.session_name}`)
      .addFields(...fields)
      .setFooter({ text: `ID: ${session.id}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}

module.exports = { ThongKePhienCommand };
