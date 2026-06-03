'use strict';
const { MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const db = require('../../db.js');
const log = require('../../utils/logger.js');
const { ScheduleView } = require('../../src/commands/setup/_ScheduleView.js');
const { CUSTOM_ID, openOneTimeDateModal } = require('./setupScheduleAddTypeModal.js');
const { parseGio, parsePreClose, parsePhutBu } = require('./setupScheduleAddDetailModal.js');

const EDIT_OT_PREFIX = 'setup:sch:edit:ot:';

class SetupScheduleEditOneTimeHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    if (interaction.customId?.startsWith('setup:sch:edit:ot:')) return this.some();
    return this.none();
  }

  async run(interaction) {
    const scheduleId = interaction.customId.slice('setup:sch:edit:ot:'.length);
    const schedule = await db.getScheduledSessionById(scheduleId);
    if (!schedule) {
      return interaction.reply({ content: '❌ Không tìm thấy lịch.', flags: MessageFlags.Ephemeral });
    }

    const date = schedule.date ? new Date(schedule.date) : null;
    const prefill = {
      dayOfMonth: date ? date.getDate() : undefined,
      month: date ? date.getMonth() + 1 : undefined,
      year: date ? date.getFullYear() : undefined,
    };

    return openOneTimeDateModal(interaction, prefill);
  }
}

class SetupScheduleEditOneTimeModalHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.ModalSubmit });
  }

  parse(interaction) {
    if (interaction.customId?.startsWith('setup:sch:edit:ot:time:')) return this.some();
    return this.none();
  }

  async run(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const scheduleId = interaction.customId.slice('setup:sch:edit:ot:time:'.length);
    const guildId = interaction.guildId;

    const sessionName = interaction.fields.getTextInputValue('ten').trim();
    const gio = parseGio(interaction.fields.getTextInputValue('gio'));
    if (!gio) {
      return interaction.editReply({ content: '❌ Giờ mở không hợp lệ. Dùng định dạng HH:MM (vd: 20:00).' });
    }

    const preClose = parsePreClose(interaction.fields.getStringSelectValues('pre_close')?.[0]);
    const phutBu = interaction.fields.getStringSelectValues('phut_bu')?.[0];

    const cfg = await db.getGuildConfig(guildId);
    const channelId = cfg?.log_channel_id ?? cfg?.channel_id;
    if (!channelId) {
      return interaction.editReply({ content: '❌ Chưa cấu hình Kênh log.' });
    }

    const schedule = await db.getScheduledSessionById(scheduleId);
    if (!schedule) {
      return interaction.editReply({ content: '❌ Không tìm thấy lịch.' });
    }

    const dayOfWeek = schedule.day_of_week ?? 0;
    const close = parsePhutBu(gio.hour, gio.minute, phutBu, dayOfWeek);

    try {
      await db.suaLichCoDinh(guildId, scheduleId, {
        dayOfWeek: schedule.day_of_week,
        hour: gio.hour,
        minute: gio.minute,
        sessionName,
        preCloseMinutes: preClose,
        closeDayOfWeek: close.closeDayOfWeek,
        closeHour: close.closeHour,
        closeMinute: close.closeMinute,
        channelId,
      });
    } catch (e) {
      log.error('SETUP_SCH_EDIT_OT', guildId, 'suaLichCoDinh thất bại: %s', e.message);
      return interaction.editReply({ content: '❌ Không thể sửa lịch, thử lại sau.' });
    }

    return interaction.editReply({
      content: `✅ Đã sửa lịch **${sessionName}** — lúc **${String(gio.hour).padStart(2,'0')}:${String(gio.minute).padStart(2,'0')}**.`,
    });
  }
}

module.exports = { SetupScheduleEditOneTimeHandler, SetupScheduleEditOneTimeModalHandler };
