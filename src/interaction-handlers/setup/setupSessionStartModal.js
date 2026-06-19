'use strict';
const { EmbedBuilder, MessageFlags } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const sessionService = require('../../../services/sessionService.js');
const configService  = require('../../../services/configService.js');
const log            = require('../../../utils/logger.js');
const { requireAdmin }   = require('../../../utils/permissions.js');
const {
  FOOTER_DEFAULT, COLORS, replyErrEdit,
} = require('../../../utils/embeds.js');
const { fmtTs }          = require('../../../utils/format.js');
const { startAutoRefresh, scheduleCloseTimer } = require('../../../utils/timers.js');
const { buildSessionEmbed } = require('../../../utils/_views/sessionView.js');
const { buildAttendanceSelectRow, buildSessionActionRow } = require('../../../utils/_views/rows.js');
const { wrapHandler } = require('../../../utils/error-boundary.js');
const { auditLog } = require('../../../utils/auditLog.js');
const { checkCooldown } = require('../../../utils/cooldown.js');

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
    return wrapHandler(async (interaction) => {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const { ok } = await requireAdmin(interaction, { context: 'mở phiên', deferred: true });
    if (!ok) return;
    if (!checkCooldown(interaction.user.id, 'setup_session_start_modal', 5000)) {
      return interaction.editReply({ content: '⏳ Vui lòng đợi một chút trước khi thực hiện hành động này.' });
    }
    const { guild } = interaction;

    try {
      const tenRaw   = interaction.fields.getTextInputValue('ten_phien')?.trim() || '';
      const phutDong = interaction.fields.getTextInputValue('phut_dong')?.trim();
      const ten = tenRaw || `Bang Chiến ${new Date().toLocaleDateString('vi-VN')}`;

      if (phutDong) {
        const n = parseInt(phutDong, 10);
        if (isNaN(n) || n < 1 || n > 1440) return interaction.editReply(replyErrEdit('Số phút không hợp lệ (1–1440).'));
      }

      const cfg = await configService.getGuildConfig(guild.id);

      const session = await sessionService.createSession({
        guild_id:        guild.id,
        session_name:    ten,
        started_by:      interaction.user.id,
        auto_close_at:   phutDong ? new Date(Date.now() + parseInt(phutDong, 10) * 60_000).toISOString() : null,
        phai_role_ids:   cfg?.phai_role_ids ?? [],
        allowed_role_id: cfg?.attendance_role_id ?? null,
      });

      // Gửi bảng điểm danh lên kênh thông báo
      const notifChannelId = cfg?.notification_channel_id;
      if (notifChannelId) {
        const ch = await guild.channels.fetch(notifChannelId).catch(() => null);
        if (ch) {
          session.channel_id = ch.id;
          await sessionService.updateSessionMessage(session.id, { channel_id: ch.id });
          // Nạp cache thành viên & role để thống kê phái chính xác
          await guild.members.fetch().catch(() => {});
          await guild.roles.fetch().catch(() => {});
          const { embed: sessionEmbed, components } = buildSessionEmbed(guild, session, [], cfg?.phai_role_ids ?? [], false, 1, cfg?.phai_role_icons ?? null);
          const selectRow = buildAttendanceSelectRow(true);
          const adminRows = buildSessionActionRow(true);
          const msg = await ch.send({ embeds: [sessionEmbed], components: [selectRow, ...adminRows, ...components].slice(0, 5) });
          await sessionService.updateSessionMessage(session.id, { message_id: msg.id });

          // Ping attendance role
          if (cfg?.attendance_role_id) {
            await ch.send({ content: `<@&${cfg.attendance_role_id}> Bang Chiến điểm danh **${session.session_name}** đã mở!` }).catch(() => null);
          }

          startAutoRefresh(session.id, ch.id, msg.id, interaction.client);

          if (session.auto_close_at) {
            const msLeft = new Date(session.auto_close_at).getTime() - Date.now();
            if (msLeft > 0) scheduleCloseTimer(interaction.client, guild, session, ch.id, msLeft);
          }
        } else {
          log.warn('SESSION_START_MODAL', guild.id, 'Không tìm thấy kênh thông báo %s', notifChannelId);
        }
      } else {
        log.warn('SESSION_START_MODAL', guild.id, 'Chưa cấu hình kênh thông báo, bỏ qua gửi embed');
      }

      const embed = new EmbedBuilder()
        .setTitle(`✅ Đã mở Bang Chiến: ${session.session_name ?? 'Không tên'}`)
        .setColor(COLORS.SUCCESS)
        .addFields(
          { name: 'Bắt đầu', value: fmtTs(session.started_at ?? new Date().toISOString()), inline: true },
          { name: 'Đóng lúc', value: session.auto_close_at ? fmtTs(session.auto_close_at) : 'Thủ công', inline: true },
        )
        .setFooter({ text: `${FOOTER_DEFAULT} · ID Bang Chiến: ${session.id}` });

      auditLog({ guildId: guild.id, actorId: interaction.user.id, action: 'SESSION_CREATE', targetId: session.id, metadata: { session_name: ten, channel_id: notifChannelId, auto_close_at: session.auto_close_at } }).catch(() => {});
      return interaction.editReply({ embeds: [embed], components: [] });
    } catch (e) {
      log.error('SESSION_START_MODAL', guild.id, 'Lỗi tạo phiên: %s', e.message);
      return interaction.editReply(replyErrEdit(`Không thể tạo Bang Chiến: ${e.message}`));
    }
  }, 'SetupSessionStartModalHandler')(interaction); }
}

module.exports = { SetupSessionStartModalHandler };
