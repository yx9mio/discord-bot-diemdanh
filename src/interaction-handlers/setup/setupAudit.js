'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const { AuditView } = require('../../commands/setup/_views/_AuditView.js');
const { getAuditLogs, getAuditLogCount } = require('../../../utils/auditLog.js');
const log = require('../../../utils/logger.js');
const { CUSTOM_ID, PAGE_SIZE } = AuditView;
const { wrapHandler } = require('../../../utils/error-boundary.js');
const { checkCooldown } = require('../../../utils/cooldown.js');

function _readFilter(interaction) {
  try {
    const footer = interaction.message?.embeds?.[0]?.footer?.text ?? '';
    const m = footer.match(/Lọc: (\w+)/);
    return m ? m[1] : 'all';
  } catch { return 'all'; }
}

function _readPage(interaction) {
  try {
    const footer = interaction.message?.embeds?.[0]?.footer?.text ?? '';
    const m = footer.match(/Trang (\d+)\/(\d+)/);
    return m ? parseInt(m[1], 10) - 1 : 0;
  } catch { return 0; }
}

const BUTTON_IDS = new Set([CUSTOM_ID.AUDIT, CUSTOM_ID.NEXT, CUSTOM_ID.PREV, CUSTOM_ID.REFRESH]);

class SetupAuditHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    if (BUTTON_IDS.has(interaction.customId)) return this.some();
    return this.none();
  }

  async run(interaction) {
    return wrapHandler(async (interaction) => {
    await interaction.deferUpdate();
    if (!checkCooldown(interaction.user.id, 'setup_audit', 1000)) return interaction.editReply({ content: '⏳ Vui lòng đợi một chút...' });
    const { guild, customId } = interaction;

    try {
      const actionFilter = _readFilter(interaction);
      const actions = AuditView.expandFilter(actionFilter);
      let nextPage = customId === CUSTOM_ID.AUDIT ? 0 : _readPage(interaction);
      if (customId === CUSTOM_ID.NEXT) nextPage++;
      if (customId === CUSTOM_ID.PREV) nextPage--;

      const offset = nextPage * PAGE_SIZE;
      const [{ rows }, totalCount] = await Promise.all([
        getAuditLogs({ guildId: guild.id, limit: PAGE_SIZE, offset, actions }),
        getAuditLogCount({ guildId: guild.id, actions }),
      ]);

      return interaction.editReply(AuditView.render({ rows, page: nextPage, actionFilter, guild, totalCount }));
    } catch (e) {
      log.error('AUDIT_VIEW', guild?.id, 'run thất bại: %s', e?.message ?? e);
      return interaction.editReply({ content: '❌ Không thể tải nhật ký Bang. Thử lại sau.', embeds: [], components: [] });
    }
  }, 'SetupAuditHandler')(interaction); }
}

module.exports = { SetupAuditHandler };
