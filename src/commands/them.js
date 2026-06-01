// src/commands/them.js
'use strict';
const { Command } = require('@sapphire/framework');
const { PermissionFlagsBits, MessageFlags } = require('discord.js');
const db = require('../../db.js');

const STATUS_LABEL = { tham_gia: '✅ Tham gia', tre: '⏰ Trễ', khong_tham_gia: '❌ Vắng', co_phep: '🟡 Có phép' };

class ThemCommand extends Command {
  constructor(context) {
    super(context, { name: 'them', description: 'Thêm thành viên vào phiên điểm danh hiện tại', preconditions: ['AdminOnly'] });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand(builder =>
      builder
        .setName('them')
        .setDescription('Thêm thành viên vào phiên điểm danh hiện tại')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addUserOption(o => o.setName('thanh_vien').setDescription('Thành viên cần thêm').setRequired(true))
        .addStringOption(o =>
          o.setName('trang_thai').setDescription('Trạng thái (mặc định: tham gia)').setRequired(false)
            .addChoices(
              { name: '✅ Tham gia', value: 'tham_gia' },
              { name: '⏰ Đến trễ',  value: 'tre' },
              { name: '❌ Vắng',     value: 'khong_tham_gia' },
              { name: '🟡 Có phép',  value: 'co_phep' },
            )
        )
    );
  }

  async chatInputRun(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const { guild } = interaction;
    const target  = interaction.options.getUser('thanh_vien');
    const status  = interaction.options.getString('trang_thai') ?? 'tham_gia';
    const session = await db.getActiveSession(guild.id);
    if (!session) return interaction.editReply({ content: '⚠️ Không có phiên nào đang mở.' });

    await db.upsertAttendance({ session_id: session.id, user_id: target.id, status, updated_by: interaction.user.id });
    await interaction.editReply({ content: `✅ Đã thêm <@${target.id}>: **${STATUS_LABEL[status]}**` });
  }
}

module.exports = { ThemCommand };
