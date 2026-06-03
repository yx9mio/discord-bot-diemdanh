// src/commands/admin/admin.js
// [C1] Dashboard Admin tập trung với StringSelectMenu
'use strict';
const { Command } = require('@sapphire/framework');
const { MessageFlags, SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const db = require('../../../db.js');
const { requireAdmin } = require('../../../utils/permissions.js');

class AdminCommand extends Command {
  constructor(context) {
    super(context, { name: 'admin', description: 'Dashboard Admin — quản lý phiên điểm danh', preconditions: ['AdminOnly'] });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand(
      new SlashCommandBuilder()
        .setName('admin')
        .setDescription('Dashboard Admin — quản lý phiên điểm danh')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    );
  }

  async chatInputRun(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const { ok } = await requireAdmin(interaction, { context: 'admin dashboard', deferred: true });
    if (!ok) return;

    const { guild } = interaction;
    const session = await db.getActiveSession(guild.id);

    const adminSelect = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('admin:select')
        .setPlaceholder('👆 Chọn hành động admin...')
        .addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel('🗒️ Xem danh sách điểm danh')
            .setDescription('Xem danh sách đầy đủ thành viên đã điểm danh')
            .setValue('view_attendance'),
          new StringSelectMenuOptionBuilder()
            .setLabel('✏️ Điểm danh thay')
            .setDescription('Điểm danh thay cho thành viên khác')
            .setValue('mark_attendance'),
          new StringSelectMenuOptionBuilder()
            .setLabel('📊 Xuất CSV')
            .setDescription('Xuất báo cáo điểm danh dạng CSV')
            .setValue('export_csv'),
          new StringSelectMenuOptionBuilder()
            .setLabel('🔄 Làm mới embed')
            .setDescription('Làm mới embed chính phiên')
            .setValue('refresh_embed'),
        )
    );

    if (session) {
      adminSelect.components[0].addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('🔒 Đóng phiên')
          .setDescription('Đóng phiên điểm danh đang mở')
          .setValue('close_session'),
      );
    }

    const embed = {
      title: '🔧 Admin Dashboard',
      description: session
        ? `🟢 Phiên đang mở: **${session.session_name}**\nChọn hành động admin từ menu dưới:`
        : `📭 Không có phiên nào đang mở\nChọn hành động admin từ menu dưới:`,
      color: 0x5865F2,
    };

    return interaction.editReply({ embeds: [embed], components: [adminSelect] });
  }
}

module.exports = { AdminCommand };
