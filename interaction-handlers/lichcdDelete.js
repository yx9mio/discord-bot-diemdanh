// interaction-handlers/lichcdDelete.js
// Handles: lichcd:del:<scheduleId>
// Xóa 1 lịch cố định qua nút bấm — cập nhật lại embed & danh sách nút
// (Commit 2: dùng table scheduled_sessions thay cho JSON cfg.schedules)
'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const db = require('../db.js');
const { buildScheduleDeleteRows, buildLichcdEmbed } = require('../src/commands/schedule/lichcodinh.js');

class LichcdDeleteHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    if (interaction.customId?.startsWith('lichcd:del:')) return this.some();
    return this.none();
  }

  async run(interaction) {
    await interaction.deferUpdate();
    const { guild, customId } = interaction;

    // customId format: lichcd:del:<scheduleId> (UUID)
    const scheduleId = customId.split(':')[2];
    if (!scheduleId) return;

    try {
      await db.deleteScheduledSession(scheduleId);
    } catch (_e) {
      return interaction.followUp({ content: '⚠️ Không thể xoá lịch này.', ephemeral: true });
    }

    const schedules = await db.getScheduledSessions(guild.id);
    const newEmbed  = buildLichcdEmbed(schedules);
    const newRows   = buildScheduleDeleteRows(schedules);

    await interaction.editReply({ embeds: [newEmbed], components: newRows });
    await interaction.followUp({ content: '✅ Đã xóa lịch.', ephemeral: true }).catch(() => null);
  }
}

module.exports = { LichcdDeleteHandler };
