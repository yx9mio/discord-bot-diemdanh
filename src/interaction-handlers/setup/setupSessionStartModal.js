// src/interaction-handlers/setup/setupSessionStartModal.js
// Handles: setup:session:start:modal (ModalSubmit) — tạo phiên mới từ form
'use strict';
const { EmbedBuilder, MessageFlags } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const sessionService = require('../../../services/sessionService.js');
const configService  = require('../../../services/configService.js');
const log            = require('../../../utils/logger.js');
const { requireAdmin }   = require('../../../utils/permissions.js');
const {
  FOOTER_DEFAULT,
  COLORS,
} = require('../../../utils/embeds.js');
const { fmtTs }          = require('../../../utils/format.js');
const { startAutoRefresh } = require('../../../utils/timers.js');

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
    const { ok } = await requireAdmin(interaction, { context: 'mở phiên', deferred: true });
    if (!ok) return;
    const { guild } = interaction;

    try {
      const ten     = interaction.fields.getTextInputValue('ten_phien')?.trim() || '';
      const phutDong = interaction.fields.getTextInputValue('phut_dong')?.trim();
      const phaiRole = interaction.fields.getTextInputValue('phai_role')?.trim();

      const cfg = await configService.getGuildConfig(guild.id);
      const tz  = cfg?.timezone ?? 'Asia/Ho_Chi_Minh';

      const session = await sessionService.createSession({
        guild_id:      guild.id,
        session_name:  ten || `Phiên ${new Date().toLocaleDateString('vi-VN')}`,
        auto_close_at: phutDong ? new Date(Date.now() + parseInt(phutDong, 10) * 60_000).toISOString() : null,
        phai_role_ids: phaiRole ? [phaiRole] : null,
      });

      const embed = new EmbedBuilder()
        .setTitle(`✅ Đã mở phiên: ${session.session_name ?? 'Không tên'}`)
        .setColor(COLORS.SUCCESS)
        .addFields(
          { name: 'Bắt đầu', value: fmtTs(session.started_at ?? new Date().toISOString(), tz), inline: true },
          { name: 'Đóng lúc', value: session.auto_close_at ? fmtTs(session.auto_close_at, tz) : 'Thủ công', inline: true },
        )
        .setFooter({ text: `${FOOTER_DEFAULT} · Session ID: ${session.id}` });

      return interaction.editReply({ embeds: [embed], components: [] });
    } catch (e) {
      log.error('SESSION_START_MODAL', guild.id, 'Lỗi tạo phiên: %s', e.message);
      return interaction.editReply({ content: `❌ Không thể tạo phiên: ${e.message}` });
    }
  }
}

module.exports = { SetupSessionStartModalHandler };
