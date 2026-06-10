'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const { MessageFlags } = require('discord.js');
const { HomeView } = require('../../commands/setup/_views/_HomeView.js');
const { requireAdmin } = require('../../../utils/permissions.js');
const { buildInactiveEmbed } = require('../../../utils/inactiveHelper.js');
const log = require('../../../utils/logger.js');
const { CUSTOM_ID } = HomeView;

class SetupInactiveHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    if (interaction.customId === CUSTOM_ID.INACTIVE) return this.some();
    return this.none();
  }

  async run(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const { ok } = await requireAdmin(interaction, { context: 'xem inactive', deferred: true });
    if (!ok) return;

    try {
      const { embed, total } = await buildInactiveEmbed({
        guild: interaction.guild,
        nguong: 50,
        soLuong: 20,
        soPhienToiThieu: 3,
      });

      log.info('INACTIVE', interaction.guildId,
        '%s xem inactive từ dashboard (result=%d)',
        interaction.user.tag, total);

      return interaction.editReply({ embeds: [embed] });
    } catch (e) {
      log.error('INACTIVE', interaction.guildId, 'run thất bại: %s', e.message);
      return interaction.editReply({ content: '\u274c Không thể tải dữ liệu, thử lại sau.' });
    }
  }
}

module.exports = { SetupInactiveHandler };
