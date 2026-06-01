// src/commands/xem.js — gộp xem.js + xem_diemdanh.js
'use strict';
const { Command } = require('@sapphire/framework');
const { MessageFlags } = require('discord.js');
const db = require('../../db.js');
const { buildSessionEmbed, buildAttendanceButtons } = require('../../utils/embeds.js');

class XemCommand extends Command {
  constructor(context) {
    super(context, { name: 'xem', description: 'Xem danh sách điểm danh phiên đang mở' });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand(builder =>
      builder
        .setName('xem')
        .setDescription('Xem danh sách điểm danh phiên đang mở')
        .addBooleanOption(o =>
          o.setName('nut_bam')
            .setDescription('Hiển thị nút điểm danh nhanh (mặc định: tắt)')
            .setRequired(false)
        )
    );
  }

  async chatInputRun(interaction) {
    const showButtons = interaction.options.getBoolean('nut_bam') ?? false;
    await interaction.deferReply({ flags: showButtons ? undefined : MessageFlags.Ephemeral });

    const { guild } = interaction;
    const session = await db.getActiveSession(guild.id);
    if (!session) return interaction.editReply({ content: '⚠️ Không có phiên nào đang mở.' });

    const attended  = await db.getAttendances(session.id);
    const cfg       = await db.getGuildConfig(guild.id);
    const embed     = await buildSessionEmbed(guild, session, attended, cfg.phai_role_ids ?? []);

    if (showButtons) {
      const buttons = buildAttendanceButtons(false);
      await interaction.editReply({ embeds: [embed], components: [buttons] });
    } else {
      await interaction.editReply({ embeds: [embed] });
    }
  }
}

module.exports = { XemCommand };
