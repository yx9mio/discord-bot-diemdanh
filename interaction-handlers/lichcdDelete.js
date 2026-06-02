// interaction-handlers/lichcdDelete.js
// Handles: lichcd:del:<idx>
// Xóa 1 lịch cố định qua nút bấm — cập nhật lại embed & danh sách nút
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

    const idx = parseInt(customId.split(':')[2], 10);
    if (Number.isNaN(idx)) return;

    const cfg = await db.getGuildConfig(guild.id);
    const schedules = cfg.schedules ?? [];
    if (idx < 0 || idx >= schedules.length) {
      return interaction.followUp({ content: '⚠️ Lịch này đã bị xóa trước đó.', ephemeral: true });
    }

    schedules.splice(idx, 1);
    await db.setGuildConfig(guild.id, { schedules });

    const newEmbed = buildLichcdEmbed(schedules, cfg.auto_schedule_enabled);
    const newRows  = buildScheduleDeleteRows(schedules);

    await interaction.editReply({ embeds: [newEmbed], components: newRows });
    await interaction.followUp({ content: '✅ Đã xóa lịch.', ephemeral: true }).catch(() => null);
  }
}

module.exports = { LichcdDeleteHandler };
