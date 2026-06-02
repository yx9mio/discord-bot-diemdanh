// src/commands/admin/caidat.js
'use strict';
const { Command } = require('@sapphire/framework');
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../../db.js');
const { replyConfirm, replyErr, FOOTER_DEFAULT } = require('../../../utils/embeds.js');

class CaiDatCommand extends Command {
  constructor(context) {
    super(context, { name: 'caidat', description: 'Cài đặt bot cho server', preconditions: ['AdminOnly'] });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand(
      new SlashCommandBuilder()
        .setName('caidat')
        .setDescription('Cài đặt bot cho server')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(s => s.setName('xem').setDescription('Xem cài đặt hiện tại'))
        .addSubcommand(s => s
          .setName('kenh_log')
          .setDescription('Cài đặt kênh log')
          .addChannelOption(o => o.setName('kenh').setDescription('Kênh để gửi log').setRequired(true))
        )
        .addSubcommand(s => s
          .setName('timezone')
          .setDescription('Cài đặt múi giờ server')
          .addStringOption(o => o.setName('tz').setDescription('VD: Asia/Ho_Chi_Minh').setRequired(true))
        )
        .addSubcommand(s => s.setName('reset').setDescription('Xóa toàn bộ cài đặt về mặc định'))
    );
  }

  async chatInputRun(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const sub  = interaction.options.getSubcommand();
    const { guild } = interaction;
    const cfg  = await db.getGuildConfig(guild.id);

    if (sub === 'xem') {
      const embed = new EmbedBuilder().setColor(0x01696f).setTitle('⚙️ Cài đặt server')
        .addFields(
          { name: '📢 Kênh log',   value: cfg.log_channel_id ? `<#${cfg.log_channel_id}>` : '_Chưa cài_', inline: true },
          { name: '🌏 Timezone',   value: cfg.timezone ?? 'Asia/Ho_Chi_Minh',                               inline: true },
          { name: '🎭 Phái',        value: (cfg.phai_role_ids ?? []).map(r => `<@&${r}>`).join(', ') || 'Tất cả', inline: false },
          { name: '🔔 Lịch cố định', value: (cfg.schedules ?? []).length ? `${(cfg.schedules ?? []).length} lịch` : '_Chưa cài_', inline: true },
          { name: '⏰ Nhắc nhở',    value: cfg.reminder_enabled === false ? '⛔ Tắt' : '✅ Bật',                inline: true },
        )
        .setFooter({ text: FOOTER_DEFAULT })
        .setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'kenh_log') {
      const ch = interaction.options.getChannel('kenh');
      await db.setGuildConfig(guild.id, { log_channel_id: ch.id });
      return interaction.editReply({ content: `✅ Kênh log: <#${ch.id}>` });
    }

    if (sub === 'timezone') {
      const tz = interaction.options.getString('tz');
      try { Intl.DateTimeFormat(undefined, { timeZone: tz }); } catch { return interaction.editReply(replyErr('Timezone không hợp lệ.')); }
      await db.setGuildConfig(guild.id, { timezone: tz });
      return interaction.editReply({ content: `✅ Timezone: \`${tz}\`` });
    }

    if (sub === 'reset') {
      return interaction.editReply(
        replyConfirm(
          'Xóa toàn bộ cài đặt về mặc định?\n> Sẽ xóa: kênh log, timezone, phái, toàn bộ lịch cố định.',
          'caidat:reset:confirm',
          'caidat:reset:cancel',
        ),
      );
    }
  }
}

module.exports = { CaiDatCommand };
