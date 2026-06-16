'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const { AuditView } = require('../../commands/setup/_views/_AuditView.js');
const { getAuditLogs, getAuditLogCount } = require('../../../utils/auditLog.js');
const log = require('../../../utils/logger.js');
const { CUSTOM_ID, PAGE_SIZE } = AuditView;
const { wrapHandler } = require('../../../utils/error-boundary.js');
const { checkCooldown } = require('../../../utils/cooldown.js');

class SetupAuditFilterHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.SelectMenu });
  }

  parse(interaction) {
    if (interaction.customId === CUSTOM_ID.FILTER) return this.some();
    return this.none();
  }

  async run(interaction) {
    return wrapHandler(async (interaction) => {
    await interaction.deferUpdate();
    if (!checkCooldown(interaction.user.id, 'setup_audit', 1000)) return interaction.editReply({ content: '⏳ Vui lòng đợi một chút...' });
    const { guild } = interaction;

    try {
      const actionFilter = interaction.values?.[0] ?? 'all';
      const actions = AuditView.expandFilter(actionFilter);
      const [{ rows }, totalCount] = await Promise.all([
        getAuditLogs({ guildId: guild.id, limit: PAGE_SIZE, offset: 0, actions }),
        getAuditLogCount({ guildId: guild.id, actions }),
      ]);

      return interaction.editReply(AuditView.render({ rows, page: 0, actionFilter, guild, totalCount }));
    } catch (e) {
      log.error('AUDIT_FILTER', guild?.id, 'run thất bại: %s', e?.message ?? e);
      return interaction.editReply({ content: '❌ Không thể lọc nhật ký. Thử lại sau.', embeds: [], components: [] });
    }
  }, 'SetupAuditFilterHandler')(interaction); }
}

module.exports = { SetupAuditFilterHandler };
