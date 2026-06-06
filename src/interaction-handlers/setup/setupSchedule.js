// interaction-handlers/setup/setupSchedule.js
'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const scheduledService = require('../../../services/scheduledService.js');
const log = require('../../../utils/logger.js');
const { ScheduleView } = require('../../commands/setup/_views/_ScheduleView.js'); // [FIX-SETUP]
const { CUSTOM_ID } = ScheduleView;

class SetupScheduleHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    const id = interaction.customId;
    if (id === 'setup:sch') return this.some();
    if (id === CUSTOM_ID.PAGE_NEXT || id === CUSTOM_ID.PAGE_PREV) return this.some();
    if (id === CUSTOM_ID.REFRESH) return this.some();
    if (id?.startsWith(CUSTOM_ID.DEL_PREFIX) &&
        !id.startsWith(CUSTOM_ID.DEL_CONFIRM) &&
        !id.startsWith(CUSTOM_ID.DEL_CANCEL)) return this.some();
    if (id?.startsWith(CUSTOM_ID.DEL_CONFIRM)) return this.some();
    if (id?.startsWith(CUSTOM_ID.DEL_CANCEL)) return this.some();
    return this.none();
  }

  async run(interaction) {
    const { customId, guild } = interaction;

    if (customId === CUSTOM_ID.REFRESH) {
      const page = _extractPageFromEmbed(interaction);
      return ScheduleView.handleRefresh(interaction, page);
    }

    if (
      customId.startsWith(CUSTOM_ID.DEL_PREFIX) &&
      !customId.startsWith(CUSTOM_ID.DEL_CONFIRM) &&
      !customId.startsWith(CUSTOM_ID.DEL_CANCEL)
    ) {
      const id = customId.slice(CUSTOM_ID.DEL_PREFIX.length);
      await interaction.reply({
        content: `⚠️ Xác nhận xóa lịch **#${id}**?`,
        flags: MessageFlags.Ephemeral,
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`${CUSTOM_ID.DEL_CONFIRM}${id}`)
              .setLabel('✅ Xác nhận xóa')
              .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
              .setCustomId(`${CUSTOM_ID.DEL_CANCEL}${id}`)
              .setLabel('↩️ Hủy')
              .setStyle(ButtonStyle.Secondary),
          ),
        ],
      });
      return;
    }

    if (customId.startsWith(CUSTOM_ID.DEL_CANCEL)) {
      await interaction.deferUpdate();
      return interaction.editReply({ content: '↩️ Đã hủy.', components: [] });
    }

    if (customId.startsWith(CUSTOM_ID.DEL_CONFIRM)) {
      await interaction.deferUpdate();
      const id = customId.slice(CUSTOM_ID.DEL_CONFIRM.length);
      try {
        await scheduledService.deleteScheduledSession(guild.id, id);
        log.info('SETUP_SCH', guild.id, 'Xóa lịch %s qua /setup', id);
      } catch (e) {
        log.error('SETUP_SCH', guild.id, 'deleteScheduledSession thất bại: %s', e.message);
        return interaction.editReply({ content: '❌ Không thể xóa lịch, thử lại sau.', components: [] });
      }
      await interaction.editReply({ content: `✅ Đã xóa lịch #${id}.`, components: [] });
      try {
        const schedules = await scheduledService.getScheduledSessions(guild.id);
        const page = _extractPageFromEmbed(interaction);
        await interaction.message?.edit(ScheduleView.render({ schedules, page, guild })).catch(() => null);
      } catch (_e) { /* fallthrough */ }
      return;
    }

    await interaction.deferUpdate();
    const schedules = await scheduledService.getScheduledSessions(guild.id);
    const curPage = _extractPageFromEmbed(interaction);
    const newPage = customId === CUSTOM_ID.PAGE_NEXT
      ? Math.min(curPage + 1, Math.ceil(schedules.length / ScheduleView.PAGE_SIZE) - 1)
      : Math.max(0, curPage - 1);
    return interaction.editReply(ScheduleView.render({ schedules, page: newPage, guild }));
  }
}

function _extractPageFromEmbed(interaction) {
  try {
    const embed = interaction.message?.embeds?.[0];
    const footer = embed?.footer?.text ?? '';
    const match = footer.match(/Trang (\d+)\/(\d+)/);
    if (match) return Math.max(0, parseInt(match[1], 10) - 1);
  } catch (_e) { /* fallthrough */ }
  return 0;
}

module.exports = { SetupScheduleHandler };
