'use strict';
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const sessionService = require('../../../services/sessionService.js');
const configService  = require('../../../services/configService.js');
const log            = require('../../../utils/logger.js');
const { requireAdmin }   = require('../../../utils/permissions.js');
const { FOOTER_DEFAULT, COLORS, replyErrEdit } = require('../../../utils/embeds.js');
const { fmtTs }          = require('../../../utils/format.js');
const { startAutoRefresh, scheduleCloseTimer } = require('../../../utils/timers.js');
const { buildSessionEmbed } = require('../../../utils/_views/sessionView.js');
const { buildBoardRow } = require('../../../utils/_views/rows.js');
const { wrapHandler } = require('../../../utils/error-boundary.js');
const { checkCooldown } = require('../../../utils/cooldown.js');
const { auditLog } = require('../../../utils/auditLog.js');
const wizardDraft = require('../../../utils/wizardDraft.js');
const {
  renderStep3, BTN_NEXT, BTN_BACK, BTN_CANCEL, BTN_CONFIRM,
} = require('../../../utils/_views/wizardView.js');
const { MODAL_ID } = require('./setupSessionStartModal.js');

class SetupSessionWizardButtonHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    const id = interaction.customId;
    if ([BTN_NEXT, BTN_BACK, BTN_CANCEL, BTN_CONFIRM].includes(id)) return this.some();
    return this.none();
  }

  async run(interaction) {
    return wrapHandler(async (interaction) => {
    if (!checkCooldown(interaction.user.id, 'setup_wizard', 1000)) {
      return interaction.reply({ content: '⏳ Vui lòng đợi một chút...', flags: MessageFlags.Ephemeral });
    }
    const { customId, guild } = interaction;
    const draft = wizardDraft.get(interaction.user.id);

    if (!draft) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      return interaction.editReply({ content: '⏳ Phiên tạo đã hết hạn, bấm **➕ Mở Kỳ mới** để bắt đầu lại.' });
    }

    // ── Hủy ──────────────────────────────────────────────────────────────────
    if (customId === BTN_CANCEL) {
      wizardDraft.clear(interaction.user.id);
      await interaction.deferUpdate();
      return interaction.editReply({ content: 'Đã hủy tạo Bang Chiến.', embeds: [], components: [] });
    }

    // ── Quay lại → mở lại modal B1 với giá trị đã nhập ───────────────────────
    if (customId === BTN_BACK) {
      const modal = new ModalBuilder()
        .setCustomId(MODAL_ID)
        .setTitle('Mở Bang Chiến điểm danh mới');
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('ten_phien').setLabel('Tên Bang Chiến').setStyle(TextInputStyle.Short)
            .setMaxLength(100).setRequired(false).setPlaceholder('Để trống để đặt tên tự động')
            .setValue(draft.ten === `Bang Chiến ${new Date().toLocaleDateString('vi-VN')}` ? '' : draft.ten),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('mo_ta').setLabel('Mô tả (tuỳ chọn)').setStyle(TextInputStyle.Paragraph)
            .setMaxLength(500).setRequired(false)
            .setValue(draft.moTa ?? ''),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('phut_dong').setLabel('Số phút tự đóng (tuỳ chọn)').setStyle(TextInputStyle.Short)
            .setMaxLength(4).setRequired(false).setPlaceholder('VD: 30 — để trống = đóng thủ công')
            .setValue(draft.phut ? String(draft.phut) : ''),
        ),
      );
      return interaction.showModal(modal);
    }

    // ── Tiếp theo → B3 tóm tắt ───────────────────────────────────────────────
    if (customId === BTN_NEXT) {
      if (!draft.channelId) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        return interaction.editReply({ content: '⚠️ Hãy chọn **kênh** đăng bảng điểm danh trước.' });
      }
      await interaction.deferUpdate();
      return interaction.editReply(renderStep3({ guild, draft }));
    }

    // ── Xác nhận → tạo phiên + đăng board ────────────────────────────────────
    if (customId === BTN_CONFIRM) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const { ok } = await requireAdmin(interaction, { context: 'mở phiên', deferred: true });
      if (!ok) return;
      const fresh = wizardDraft.get(interaction.user.id);
      if (!fresh) return interaction.editReply({ content: '⏳ Phiên tạo đã hết hạn, bấm **➕ Mở Kỳ mới** để bắt đầu lại.' });

      try {
        const cfg = await configService.getGuildConfig(guild.id);

        const session = await sessionService.createSession({
          guild_id:        guild.id,
          session_name:    fresh.ten,
          started_by:      interaction.user.id,
          auto_close_at:   fresh.phut ? new Date(Date.now() + fresh.phut * 60_000).toISOString() : null,
          phai_role_ids:   cfg?.phai_role_ids ?? [],
          allowed_role_id: fresh.roleId ?? cfg?.attendance_role_id ?? null,
          description:     fresh.moTa || null,
        });

        // Đăng bảng điểm danh lên kênh đã chọn (B2)
        const ch = await guild.channels.fetch(fresh.channelId).catch(() => null);
        if (ch) {
          session.channel_id = ch.id;
          await sessionService.updateSessionMessage(session.id, { channel_id: ch.id });
          await guild.members.fetch().catch(() => {});
          await guild.roles.fetch().catch(() => {});
          const { embed: sessionEmbed } = buildSessionEmbed(guild, session, [], cfg?.phai_role_ids ?? [], false, 1, cfg?.phai_role_icons ?? null, true, { showList: false });
          const boardRows = buildBoardRow(true);
          const msg = await ch.send({ embeds: [sessionEmbed], components: [boardRows] });
          await sessionService.updateSessionMessage(session.id, { message_id: msg.id });

          if (fresh.roleId) {
            await ch.send({ content: `<@&${fresh.roleId}> Bang Chiến điểm danh **${session.session_name}** đã mở!` }).catch(() => null);
          }

          startAutoRefresh(session.id, ch.id, msg.id, interaction.client);

          if (session.auto_close_at) {
            const msLeft = new Date(session.auto_close_at).getTime() - Date.now();
            if (msLeft > 0) scheduleCloseTimer(interaction.client, guild, session, ch.id, msLeft);
          }
        } else {
          log.warn('SESSION_START_WIZARD', guild.id, 'Không tìm thấy kênh %s', fresh.channelId);
        }

        const embed = new EmbedBuilder()
          .setTitle(`✅ Đã mở Bang Chiến: ${session.session_name ?? 'Không tên'}`)
          .setColor(COLORS.SUCCESS)
          .addFields(
            { name: 'Bắt đầu', value: fmtTs(session.started_at ?? new Date().toISOString(), cfg?.timezone), inline: true },
            { name: 'Đóng lúc', value: session.auto_close_at ? fmtTs(session.auto_close_at, cfg?.timezone) : 'Thủ công', inline: true },
          )
          .setFooter({ text: `${FOOTER_DEFAULT} · ID Bang Chiến: ${session.id}` });

        auditLog({ guildId: guild.id, actorId: interaction.user.id, action: 'SESSION_CREATE', targetId: session.id, metadata: { session_name: fresh.ten, channel_id: fresh.channelId, auto_close_at: session.auto_close_at } }).catch(() => {});
        wizardDraft.clear(interaction.user.id);
        return interaction.editReply({ embeds: [embed], components: [] });
      } catch (e) {
        log.error('SESSION_START_WIZARD', guild.id, 'Lỗi tạo phiên: %s', e.message);
        return interaction.editReply(replyErrEdit(`Không thể tạo Bang Chiến: ${e.message}`));
      }
    }

    return interaction.deferUpdate();
  }, 'SetupSessionWizardButton')(interaction); }
}

module.exports = { SetupSessionWizardButtonHandler };