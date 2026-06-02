// src/commands/admin/setup.js
'use strict';
const { Command } = require('@sapphire/framework');
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../../db.js');

class SetupCommand extends Command {
  constructor(context) {
    super(context, { name: 'setup', description: 'Hướng dẫn cài đặt ban đầu cho server', preconditions: ['AdminOnly'] });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand(
      new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Hướng dẫn cài đặt ban đầu cho server')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    );
  }

  async chatInputRun(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guild } = interaction;
    const cfg = await db.getGuildConfig(guild.id);

    const steps = [
      `${cfg.log_channel_id ? '✅' : '⬜'} **Kênh log** — \`/caidat kenh_log\``,
      `${(cfg.phai_role_ids ?? []).length ? '✅' : '⬜'} **Phái** — \`/caidatphai them\``,
      `${(cfg.schedules ?? []).length ? '✅' : '⬜'} **Lịch cố định** — \`/lichcodinh them\``,
      `${cfg.timezone ? '✅' : '⬜'} **Timezone** — \`/caidat timezone\` (hiện tại: ${cfg.timezone ?? 'Asia/Ho_Chi_Minh'})`,
    ];

    const embed = new EmbedBuilder()
      .setColor(0x01696f)
      .setTitle('🚀 Hướng dẫn cài đặt — Quản Gia Bot')
      .setDescription(steps.join('\n'))
      .addFields(
        { name: '📖 Bắt đầu nhanh', value: '1. Dùng `/bat_dau` để mở phiên\n2. Thành viên dùng `/diemdanh`\n3. Dùng `/ket_thuc` để kết thúc' }
      )
      .setFooter({ text: 'Xem `/help` để biết toàn bộ lệnh' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}

module.exports = { SetupCommand };
