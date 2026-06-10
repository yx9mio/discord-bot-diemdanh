'use strict';
const { MessageFlags } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const scheduledService = require('../../../services/scheduledService.js');
const { requireAdmin } = require('../../../utils/permissions.js');
const { replyErrEdit } = require('../../../utils/embeds.js');
const log = require('../../../utils/logger.js');

const EDIT_ONETIME_PREFIX = 'setup:sch:edit:onetime:';

class SetupScheduleEditOneTimeModalSubmitHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.ModalSubmit });
  }

  parse(interaction) {
    if (interaction.customId.startsWith(EDIT_ONETIME_PREFIX)) return this.some();
    return this.none();
  }

  async run(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const { ok } = await requireAdmin(interaction, { context: 'sửa lịch', deferred: true });
    if (!ok) return;

    const scheduleId = interaction.customId.slice(EDIT_ONETIME_PREFIX.length);
    const { guild } = interaction;

    try {
      const ngay        = interaction.fields.getTextInputValue('ngay').trim();
      const gio_bat_dau  = interaction.fields.getTextInputValue('gio_bat_dau').trim();
      const gio_ket_thuc = interaction.fields.getTextInputValue('gio_ket_thuc').trim();
      const ten          = interaction.fields.getTextInputValue('ten')?.trim() ?? '';

      if (!ngay) return interaction.editReply(replyErrEdit('Ngày không được để trống.'));
      if (!gio_bat_dau) return interaction.editReply(replyErrEdit('Giờ bắt đầu không được để trống.'));

      await scheduledService.updateScheduledSession(guild.id, scheduleId, {
        ngay, gio_bat_dau, gio_ket_thuc, ten,
      });

      const { ScheduleView } = require('../../commands/setup/_views/_ScheduleView.js');
      const sessions = await scheduledService.getScheduledSessions(guild.id);
      await interaction.message?.edit(ScheduleView.render({ schedules: sessions, guild, page: 0 })).catch(() => null);
      return interaction.editReply({ content: '✅ Đã cập nhật lịch.' });
    } catch (e) {
      log.error('SCH_EDIT_SUBMIT', guild.id, 'Lỗi lưu sửa %s: %s', scheduleId, e.message);
      return interaction.editReply(replyErrEdit(`Không thể lưu thay đổi: ${e.message}`));
    }
  }
}

module.exports = { SetupScheduleEditOneTimeModalSubmitHandler };
