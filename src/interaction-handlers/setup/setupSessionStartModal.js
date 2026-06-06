// src/interaction-handlers/setup/setupSessionStartModal.js
// Handles: setup:session:start:modal (ModalSubmit) — tạo phiên mới từ form
'use strict';
const { MessageFlags, ActionRowBuilder, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const sessionService = require('../../../services/sessionService.js');
const configService  = require('../../../services/configService.js');
const log            = require('../../../utils/logger.js');
const { requireAdmin }   = require('../../../utils/permissions.js');
const { FOOTER_DEFAULT } = require('../../../utils/embeds.js');
const { fmtTs }          = require('../../../utils/format.js');
const { datHenGioDong, startAutoRefresh } = require('../../../utils/timers.js');

const MODAL_ID = 'setup:session:start:modal';

class SetupSessionStartModalHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.ModalSubmit });
  }

  parse(interaction) {
    if (interaction.customId === MODAL_ID) return this.some();
    return this.none();
  }

  async run(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const { ok } = await requireAdmin(interaction, { context: 'mở phiên từ /setup', deferred: true });
    if (!ok) return;

    const { guild, client, user } = interaction;
    const existing = await sessionService.getActiveSession(guild.id);
    if (existing) {
      return interaction.editReply({ content: `⚠️ Đang có phiên **${existing.session_name}** đang mở.` });
    }

    const sessionName = interaction.fields.getTextInputValue('ten_phien').trim() || `Phiên ${fmtTs(new Date().toISOString())}`;
    const moTa        = interaction.fields.getTextInputValue('mo_ta').trim() || null;
    const phutVal     = (interaction.fields.getTextInputValue('phut_dong') || '').trim() || '0';
    const phut        = parseInt(phutVal, 10) || null;
    const phaiRoleId  = interaction.fields.getTextInputValue('phai_role').trim() || null;

    const cfg = await configService.getGuildConfig(guild.id);
    const phaiRoleIds = phaiRoleId ? [phaiRoleId] : (cfg?.phai_role_ids ?? []);
    let eligibleIds = null;
    if (phaiRoleIds.length) {
      await guild.members.fetch();
      eligibleIds = guild.members.cache
        .filter(m => !m.user.bot && m.roles.cache.some(r => phaiRoleIds.includes(r.id)))
        .map(m => m.id);
    }

    const session = await sessionService.createSession({
      guildId: guild.id, sessionName, description: moTa,
      eligibleMemberIds: eligibleIds, phaiRoleIds, started_by: user.id,
    });

    const embed = new EmbedBuilder()
      .setColor(0x01696f)
      .setTitle('🟢 Phiên điểm danh đã mở')
      .setDescription(`**${sessionName}**${moTa ? `\n${moTa}` : ''}`)
      .addFields(
        { name: '🆔 ID',        value: `\`${session.id}\``,                                         inline: true },
        { name: '⏱️ Bắt đầu', value: fmtTs(session.started_at),                                  inline: true },
        { name: '⏳ Tự đóng',  value: phut ? `Sau ${phut} phút` : 'Không',                        inline: true },
        { name: '👥 Bắt buộc', value: eligibleIds ? `${eligibleIds.length} thành viên` : 'Tất cả', inline: true },
        { name: '🛡️ Phái',   value: phaiRoleId ? `<@&${phaiRoleId}>` : (phaiRoleIds.length ? 'Theo cấu hình' : 'Không'), inline: true },
      )
      .setFooter({ text: FOOTER_DEFAULT })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('attendance:select')
        .setPlaceholder('👆 Chọn trạng thái điểm danh...')
        .addOptions(
          new StringSelectMenuOptionBuilder().setLabel('✅ Điểm danh').setDescription('Điểm danh đúng giờ').setValue('tham_gia'),
          new StringSelectMenuOptionBuilder().setLabel('⏰ Trễ').setDescription('Điểm danh muộn').setValue('tre'),
          new StringSelectMenuOptionBuilder().setLabel('❌ Không tham gia').setDescription('Báo vắng mặt').setValue('khong_tham_gia'),
        ),
    );

    const targetChannel = cfg?.notification_channel_id
      ? (guild.channels.cache.get(cfg.notification_channel_id) ?? interaction.channel)
      : interaction.channel;

    const msg = await targetChannel.send({ embeds: [embed], components: [row] });
    await sessionService.updateSessionMessage(session.id, { messageId: msg.id, channelId: targetChannel.id });
    startAutoRefresh(session.id, targetChannel.id, msg.id, client);
    if (phut) datHenGioDong(client, guild, session, targetChannel.id, phut * 60_000);

    log.info('SESSION_START', guild.id, 'Mở phiên %s bởi %s', session.id, user.id);
    return interaction.editReply({ content: `✅ Đã mở phiên **${sessionName}** tại <#${targetChannel.id}>.` });
  }
}

module.exports = { SetupSessionStartModalHandler };
