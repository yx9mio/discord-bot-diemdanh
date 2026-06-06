// interaction-handlers/setup/setupSchedule.js
'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const { MessageFlags } = require('discord.js');
const scheduledService = require('../../../../services/scheduledService.js');
const log = require('../../../../utils/logger.js');
const { requireAdmin } = require('../../../../utils/permissions.js');
const { ScheduleView } = require('../../commands/setup/_views/_ScheduleView.js');
const { CUSTOM_ID } = ScheduleView;

class SetupScheduleHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    const id = interaction.customId;
    if (id === 'setup:sch') return this.some();
    if (id === CUSTOM_ID.ADD || id === CUSTOM_ID.REFRESH) return this.some();
    if (id?.startsWith(CUSTOM_ID.DEL_PREFIX) && !id.includes(':confirm') && !id.includes(':cancel')) return this.some();
    if (id?.startsWith(CUSTOM_ID.DEL_PREFIX + 'confirm:')) return this.some();
    if (id?.startsWith(CUSTOM_ID.DEL_PREFIX + 'cancel:'))  return this.some();
    if (id?.startsWith(CUSTOM_ID.EDIT_PREFIX)) return this.some();
    return this.none();
  }

  async run(interaction) {
    const { customId, guild } = interaction;

    if (customId === 'setup:sch' || customId === CUSTOM_ID.REFRESH) {
      await interaction.deferUpdate();
      const schedules = await scheduledService.getScheduledSessions(guild.id);
      return interaction.editReply(ScheduleView.render({ schedules, guild }));
    }

    if (customId === CUSTOM_ID.ADD) {
      return interaction.showModal(ScheduleView.buildAddTypeModal());
    }

    if (customId?.startsWith(CUSTOM_ID.DEL_PREFIX) && !customId.includes(':confirm') && !customId.includes(':cancel')) {
      const schId = customId.slice(CUSTOM_ID.DEL_PREFIX.length);
      await interaction.deferUpdate();
      return interaction.editReply({
        content: `⚠️ Xác nhận xoá lịch cố định **#${schId}**?`,
        embeds: [], components: [
          new (require('discord.js').ActionRowBuilder)().addComponents(
            new (require('discord.js').ButtonBuilder)().setCustomId(`${CUSTOM_ID.DEL_PREFIX}confirm:${schId}`).setLabel('✅ Xoá').setStyle(require('discord.js').ButtonStyle.Danger),
            new (require('discord.js').ButtonBuilder)().setCustomId(`${CUSTOM_ID.DEL_PREFIX}cancel:${schId}`).setLabel('↩️ Hủy').setStyle(require('discord.js').ButtonStyle.Secondary),
          ),
        ],
      });
    }

    if (customId?.startsWith(CUSTOM_ID.DEL_PREFIX + 'confirm:')) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const { ok } = await requireAdmin(interaction, { context: 'xoá lịch', deferred: true });
      if (!ok) return;
      const schId = customId.slice((CUSTOM_ID.DEL_PREFIX + 'confirm:').length);
      try {
        await scheduledService.deleteScheduledSession(guild.id, schId);
        log.info('SCH_DEL', guild.id, 'Xoá lịch %s', schId);
        return interaction.editReply({ content: '✅ Đã xoá lịch cố định.' });
      } catch (e) {
        log.error('SCH_DEL', guild.id, 'deleteScheduledSession thất bại: %s', e.message);
        return interaction.editReply({ content: '❌ Không thể xoá lịch, thử lại sau.' });
      }
    }

    if (customId?.startsWith(CUSTOM_ID.DEL_PREFIX + 'cancel:')) {
      await interaction.deferUpdate();
      const schedules = await scheduledService.getScheduledSessions(guild.id).catch(() => []);
      return interaction.editReply({ ...ScheduleView.render({ schedules, guild }), content: undefined });
    }

    if (customId?.startsWith(CUSTOM_ID.EDIT_PREFIX)) {
      const schId = customId.slice(CUSTOM_ID.EDIT_PREFIX.length);
      const schedules = await scheduledService.getScheduledSessions(guild.id);
      const sch = schedules.find(s => String(s.id) === String(schId));
      if (!sch) return interaction.reply({ content: '❌ Không tìm thấy lịch này.', flags: MessageFlags.Ephemeral });
      return interaction.showModal(ScheduleView.buildEditModal(sch));
    }
  }
}

module.exports = { SetupScheduleHandler };
