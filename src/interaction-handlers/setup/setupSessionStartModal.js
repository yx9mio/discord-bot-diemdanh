// src/interaction-handlers/setup/setupSessionStartModal.js
// Handles: setup:session:start:modal (ModalSubmit) — tạo phiên mới từ form
// [FIX-SELECT] buildAttendanceSelectRow() + buildSessionActionRow() đã được xóa khỏi SessionView
//             → build inline tại đây hoặc dùng SessionView.renderActive()
// [FIX-PATH]  ../../../ → ../../../../
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
    const { ok } = await requireAdmin(interaction, { context: 'mở phiên', deferred: true });
    if (!ok) return;
    const { guild } = interaction;

    try {
      const ten     = interaction.fields.getTextInputValue('ten').trim();
      const gioDong = interaction.fields.getTextInputValue('gio_dong')?.trim();

      const cfg = await configService.getGuildConfig(guild.id);
      const tz  = cfg?.timezone ?? 'Asia/Ho_Chi_Minh';

      const session = await sessionService.startSession(guild.id, {
        ten,
        gio_dong: gioDong || null,
        timezone: tz,
      });

      // Lên lịch tự đóng nếu có giờ đóng
      if (gioDong) {
        datHenGioDong(session.id, gioDong, tz, async () => {
          try {
            await sessionService.closeSession(guild.id, session.id);
          } catch (err) {
            log.error('SESSION_AUTO_CLOSE', guild.id, 'Lỗi tự đóng phiên %s: %s', session.id, err.message);
          }
        });
      }

      // Auto-refresh embed mỗi phút
      startAutoRefresh(session.id, 60_000, async () => {
        try {
          const active = await sessionService.getActiveSession(guild.id);
          if (!active) return false; // dừng refresh
          return true;
        } catch { return false; }
      });

      const embed = new EmbedBuilder()
        .setTitle(`✅ Đã mở phiên: ${session.ten ?? 'Không tên'}`)
        .setColor(COLORS.SUCCESS)
        .addFields(
          { name: 'Bắt đầu', value: fmtTs(session.bat_dau, tz), inline: true },
          { name: 'Đóng lúc', value: gioDong ? fmtTs(gioDong, tz) : 'Thủ công', inline: true },
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
