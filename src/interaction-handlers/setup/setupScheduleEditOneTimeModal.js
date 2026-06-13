// src/interaction-handlers/setup/setupScheduleEditOneTimeModal.js
// Handles: setup:sch:edit:* (Button) — mở modal sửa lịch (recurring hoặc one-time)
'use strict';
const { MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const scheduledService = require('../../../services/scheduledService.js');
const log = require('../../../utils/logger.js');
const { DAY_NAMES: DAY_VI } = require('../../../utils/format.js');
const { requireAdmin } = require('../../../utils/permissions.js');
const { setState } = require('../../../utils/scheduleEditState.js');
const { renderEditViewStep1 } = require('../../../utils/scheduleEditViews.js');

const EDIT_PREFIX = 'setup:sch:edit:';

function pad2(n) { return String(n).padStart(2, '0'); }

function computeDuration(hour, minute, closeHour, closeMinute) {
  if (closeHour == null || closeMinute == null) return '';
  const startTotal = (hour ?? 0) * 60 + (minute ?? 0);
  const endTotal = closeHour * 60 + closeMinute;
  const duration = endTotal >= startTotal ? endTotal - startTotal : (24 * 60 - startTotal) + endTotal;
  return String(duration);
}

class SetupScheduleEditOneTimeModalHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    if (interaction.customId.startsWith(EDIT_PREFIX)) return this.some();
    return this.none();
  }

  async run(interaction) {
    const { ok } = await requireAdmin(interaction, { context: 'sửa lịch', deferred: false });
    if (!ok) return;

    const scheduleId = interaction.customId.slice(EDIT_PREFIX.length);
    const { guild } = interaction;

    try {
      const session = await scheduledService.getScheduledSessionById(scheduleId);
      if (!session) {
        return interaction.reply({ content: '❌ Không tìm thấy lịch.', flags: MessageFlags.Ephemeral });
      }

      const isRecurring = session.type === 'recurring_weekly' || session.day_of_week != null;

      // ── Recurring: use select menu flow (like creation) ─────────────
      if (isRecurring) {
        const dur = computeDuration(session.hour, session.minute, session.close_hour, session.close_minute);
        setState(guild.id, scheduleId, {
          step: 1,
          day: session.day_of_week,
          hour: session.hour,
          minute: session.minute,
          duration: dur !== '' ? parseInt(dur, 10) : 0,
          channel: session.channel_id ?? null,
          scheduleId,
        });
        return interaction.update(renderEditViewStep1(guild, { day: session.day_of_week, hour: session.hour, minute: session.minute, scheduleId }));
      }

      // ── One-time: keep modal flow ──────────────────────────────────
      const gioBatDau = pad2(session.hour) + ':' + pad2(session.minute);
      const ten = session.session_name ?? '';
      const durationValue = computeDuration(session.hour, session.minute, session.close_hour, session.close_minute);
      const channelValue = session.channel_id ?? '';
      const ngay = session.scheduled_date ?? '';

      const fields = [
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('ngay').setLabel('Ngày (YYYY-MM-DD)')
            .setStyle(TextInputStyle.Short).setRequired(true).setValue(ngay),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('gio_mo').setLabel('Giờ mở (HH:mm)')
            .setStyle(TextInputStyle.Short).setRequired(true).setValue(gioBatDau),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('phut_bu').setLabel('Thời lượng (phút, 0 = không tự đóng)')
            .setStyle(TextInputStyle.Short).setRequired(true)
            .setValue(durationValue),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('ten').setLabel('Tên phiên (tuỳ chọn)')
            .setStyle(TextInputStyle.Short).setRequired(false).setValue(ten),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('channel_id').setLabel('Kênh thông báo (ID, để trống = mặc định)')
            .setStyle(TextInputStyle.Short).setRequired(false).setValue(channelValue),
        ),
      ];

      const modal = new ModalBuilder()
        .setCustomId(`setup:sch:edit:onetime:${scheduleId}`)
        .setTitle('Sửa lịch một lần')
        .addComponents(...fields);
      return interaction.showModal(modal);
    } catch (e) {
      log.error('SCH_EDIT_MODAL', guild.id, 'Lỗi mở sửa %s: %s', scheduleId, e.message);
      return interaction.reply({ content: `❌ Không thể mở form sửa: ${e.message}`, flags: MessageFlags.Ephemeral });
    }
  }
}

module.exports = { SetupScheduleEditOneTimeModalHandler };
