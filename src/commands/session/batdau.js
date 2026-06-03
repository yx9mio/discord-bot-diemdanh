// src/commands/session/batdau.js
// Mở phiên điểm danh mới. Tạo session, gửi embed + buttons, set timer nếu có `phut`.
'use strict';
const { Command } = require('@sapphire/framework');
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const db = require('../../../db.js');
const { datHenGioDong, startAutoRefresh } = require('../../../utils/timers.js');
const { FOOTER_DEFAULT } = require('../../../utils/embeds.js');
const { fmtTs } = require('../../../utils/format.js');

class BatDauCommand extends Command {
  constructor(context) {
    super(context, { name: 'bat_dau', description: 'Mở phiên điểm danh mới', preconditions: ['AdminOnly'] });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand(
      new SlashCommandBuilder()
        .setName('bat_dau')
        .setDescription('Mở phiên điểm danh mới')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addStringOption(o => o.setName('ten_phien').setDescription('Tên phiên (tùy chọn)').setRequired(false))
        .addStringOption(o => o.setName('mo_ta').setDescription('Mô tả phiên (tùy chọn)').setRequired(false))
        .addIntegerOption(o => o.setName('phut').setDescription('Tự đóng phiên sau N phút (mặc định: không tự đóng)').setMinValue(1).setMaxValue(1440).setRequired(false))
        .addRoleOption(o => o.setName('phai').setDescription('Chỉ điểm danh thành viên có role này (mặc định: tất cả)').setRequired(false))
    );
  }

  async chatInputRun(interaction) {
    await interaction.deferReply();
    const { guild, client } = interaction;

    const existing = await db.getActiveSession(guild.id);
    if (existing) {
      return interaction.editReply({ content: `⚠️ Đang có phiên **${existing.session_name}** đang mở. Dùng /ket_thuc hoặc /huy trước.` });
    }

    const sessionName = interaction.options.getString('ten_phien') ?? `Phiên ${fmtTs(new Date().toISOString())}`;
    const moTa        = interaction.options.getString('mo_ta') ?? null;
    const phut        = interaction.options.getInteger('phut') ?? null;
    const phaiRole    = interaction.options.getRole('phai') ?? null;

    const cfg = await db.getGuildConfig(guild.id);
    const phaiRoleIds = phaiRole
      ? [phaiRole.id]
      : (cfg.phai_role_ids ?? []);
    let eligibleIds = null;
    if (phaiRoleIds.length) {
      await guild.members.fetch();
      eligibleIds = guild.members.cache
        .filter(m => !m.user.bot && m.roles.cache.some(r => phaiRoleIds.includes(r.id)))
        .map(m => m.id);
    }

    // [A3] Persist phai_role_ids vào DB
    const session = await db.createSession({ guildId: guild.id, sessionName, description: moTa, eligibleMemberIds: eligibleIds, phaiRoleIds });

    const embed = new EmbedBuilder()
      .setColor(0x01696f)
      .setTitle(`🟢 Phiên điểm danh đã mở`)
      .setDescription(`**${sessionName}**${moTa ? `\n${moTa}` : ''}`)
      .addFields(
        { name: '🆔 ID', value: `\`${session.id}\``, inline: true },
        { name: '⏱️ Bắt đầu', value: fmtTs(session.started_at ?? session.created_at), inline: true },
        { name: '⏳ Tự đóng', value: phut ? `Sau ${phut} phút` : 'Không', inline: true },
        { name: '👥 Bắt buộc', value: eligibleIds ? `${eligibleIds.length} thành viên` : 'Tất cả', inline: true },
        { name: '🎭 Phái', value: phaiRole ? `<@&${phaiRole.id}>` : (phaiRoleIds.length ? 'Theo cấu hình' : 'Không'), inline: true },
      )
      .setFooter({ text: FOOTER_DEFAULT })
      .setTimestamp();

    // [B1] Thay button bằng StringSelectMenu cho 4 trạng thái điểm danh
    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('attendance:select')
        .setPlaceholder('👆 Chọn trạng thái điểm danh...')
        .addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel('✅ Điểm danh')
            .setDescription('Điểm danh đúng giờ')
            .setValue('tham_gia'),
          new StringSelectMenuOptionBuilder()
            .setLabel('⏰ Trễ')
            .setDescription('Điểm danh muộn')
            .setValue('tre'),
          new StringSelectMenuOptionBuilder()
            .setLabel('❌ Không tham gia')
            .setDescription('Báo vắng mặt')
            .setValue('khong_tham_gia'),
          new StringSelectMenuOptionBuilder()
            .setLabel('🏥 Có phép')
            .setDescription('Vắng mặt có lý do')
            .setValue('co_phep'),
        )
    );

    const msg = await interaction.editReply({ embeds: [embed], components: [row] });
    await db.updateSessionMessage(session.id, { messageId: msg.id, channelId: interaction.channel.id });

    // [C3] Auto-refresh embed mỗi 60s
    startAutoRefresh(session.id, interaction.channel.id, msg.id, client);

    if (phut) {
      datHenGioDong(client, guild, session, interaction.channel.id, phut * 60_000);
    }

    if (cfg.log_channel_id) {
      const logCh = guild.channels.cache.get(cfg.log_channel_id);
      if (logCh) await logCh.send({ embeds: [embed] }).catch(() => null);
    }
  }
}

module.exports = { BatDauCommand };
