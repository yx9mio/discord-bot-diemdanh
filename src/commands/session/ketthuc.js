// src/commands/session/ketthuc.js
'use strict';
const { Command } = require('@sapphire/framework');
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../../db.js');
const { buildSummaryEmbed, replyWarnEdit } = require('../../../utils/embeds.js');

class KetThucCommand extends Command {
  constructor(context) {
    super(context, { name: 'ket_thuc', description: 'Kết thúc phiên điểm danh hiện tại', preconditions: ['AdminOnly'] });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand(
      new SlashCommandBuilder()
        .setName('ket_thuc')
        .setDescription('Kết thúc phiên điểm danh hiện tại')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    );
  }

  async chatInputRun(interaction) {
    await interaction.deferReply();
    const { guild } = interaction;
    const cfg = await db.getGuildConfig(guild.id);

    const session = await db.getActiveSession(guild.id);
    if (!session) return interaction.editReply(replyWarnEdit('⚠️ Không có phiên nào đang mở.'));

    await db.closeSession(session.id);
    const attended    = await db.getAttendances(session.id);
    const phaiRoleIds = cfg.phai_role_ids ?? [];
    const embed       = buildSummaryEmbed(session, attended, guild, phaiRoleIds.length ? phaiRoleIds : null);

    await interaction.editReply({ embeds: [embed] });

    if (cfg.log_channel_id) {
      const logCh = guild.channels.cache.get(cfg.log_channel_id);
      if (logCh) await logCh.send({ embeds: [embed] }).catch(() => null);
    }
  }
}

module.exports = { KetThucCommand };
