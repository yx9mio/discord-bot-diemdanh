// src/commands/thongke.js — gộp thong_ke.js + thongkephien.js + thongke_server.js
'use strict';
const { Command } = require('@sapphire/framework');
const { PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('../../db.js');

function bar(val, max, len = 12) {
  const filled = max > 0 ? Math.round((val / max) * len) : 0;
  return '█'.repeat(filled) + '░'.repeat(len - filled);
}

class ThongKeCommand extends Command {
  constructor(context) {
    super(context, { name: 'thongke', description: 'Xem thống kê điểm danh' });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand(builder =>
      builder
        .setName('thongke')
        .setDescription('Xem thống kê điểm danh')
        .addSubcommand(s =>
          s.setName('ca_nhan').setDescription('Thống kê cá nhân hoặc của thành viên khác')
            .addUserOption(o => o.setName('thanh_vien').setDescription('Thành viên cần xem (bỏ trống = bạn)').setRequired(false))
        )
        .addSubcommand(s =>
          s.setName('phien').setDescription('Thống kê chi tiết một phiên (Admin)')
            .addStringOption(o => o.setName('phien_id').setDescription('ID phiên (bỏ trống = phiên hiện tại)').setRequired(false))
        )
        .addSubcommand(s =>
          s.setName('server').setDescription('Thống kê toàn server (Admin)')
        )
    );
  }

  // không dùng await trực tiếp — dispatch sang private methods (không cần async)
  chatInputRun(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'ca_nhan') return this.#caNhan(interaction);
    if (sub === 'phien')   return this.#phien(interaction);
    if (sub === 'server')  return this.#server(interaction);
  }

  async #caNhan(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const target = interaction.options.getUser('thanh_vien') ?? interaction.user;
    const { guild } = interaction;
    const stats  = await db.getUserStats(guild.id, target.id);
    const total  = (stats.present ?? 0) + (stats.late ?? 0) + (stats.absent ?? 0);

    const embed = new EmbedBuilder()
      .setColor(0x01696f)
      .setAuthor({ name: target.username, iconURL: target.displayAvatarURL() })
      .setTitle('📊 Thống kê điểm danh cá nhân')
      .addFields(
        { name: '✅ Tham gia',         value: `${stats.present ?? 0} / ${total}\n\`${bar(stats.present ?? 0, total)}\``, inline: false },
        { name: '⏰ Trễ',             value: `${stats.late ?? 0} / ${total}\n\`${bar(stats.late ?? 0, total)}\``,       inline: false },
        { name: '❌ Vắng',            value: `${stats.absent ?? 0} / ${total}\n\`${bar(stats.absent ?? 0, total)}\``,   inline: false },
        { name: '🔥 Streak hiện tại', value: `${stats.streak ?? 0}`,      inline: true },
        { name: '🏆 Streak max',      value: `${stats.best_streak ?? 0}`, inline: true },
      ).setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }

  async #phien(interaction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild))
      return interaction.reply({ content: '⛔ Bạn cần quyền Quản lý Server.', flags: MessageFlags.Ephemeral });

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const { guild } = interaction;
    const sessionId = interaction.options.getString('phien_id');
    const session   = sessionId ? await db.getSessionByIdRaw(sessionId, guild.id) : await db.getActiveSession(guild.id);
    if (!session) return interaction.editReply({ content: '⚠️ Không tìm thấy phiên.' });

    const attendances = await db.getAttendances(session.id);
    const counts = { tham_gia: 0, khong_tham_gia: 0, tre: 0, co_phep: 0 };
    for (const a of attendances) counts[a.status] = (counts[a.status] ?? 0) + 1;

    const embed = new EmbedBuilder()
      .setColor(0x01696f)
      .setTitle(`📋 Thống kê phiên: ${session.session_name}`)
      .addFields(
        { name: '✅ Tham gia',  value: `${counts.tham_gia}`,        inline: true },
        { name: '⏰ Trễ',      value: `${counts.tre}`,             inline: true },
        { name: '❌ Vắng',     value: `${counts.khong_tham_gia}`,  inline: true },
        { name: '🟡 Có phép',  value: `${counts.co_phep}`,         inline: true },
        { name: '📊 Tổng',     value: `${attendances.length}`,     inline: true },
      ).setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }

  async #server(interaction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild))
      return interaction.reply({ content: '⛔ Bạn cần quyền Quản lý Server.', flags: MessageFlags.Ephemeral });

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const { guild } = interaction;
    const stats = await db.getServerStats(guild.id);
    const total = (stats.total_present ?? 0) + (stats.total_late ?? 0) + (stats.total_absent ?? 0);

    const embed = new EmbedBuilder()
      .setColor(0x01696f)
      .setTitle(`📈 Thống kê Server: ${guild.name}`)
      .addFields(
        { name: '📅 Tổng phiên',    value: `${stats.total_sessions ?? 0}`, inline: true },
        { name: '👥 Tổng lượt ĐD',  value: `${total}`,                    inline: true },
        { name: '✅ Tham gia',      value: `${stats.total_present ?? 0}\n\`${bar(stats.total_present ?? 0, total, 10)}\``, inline: false },
        { name: '⏰ Trễ',          value: `${stats.total_late ?? 0}\n\`${bar(stats.total_late ?? 0, total, 10)}\``,       inline: false },
        { name: '❌ Vắng',         value: `${stats.total_absent ?? 0}\n\`${bar(stats.total_absent ?? 0, total, 10)}\``,   inline: false },
      ).setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}

module.exports = { ThongKeCommand };
