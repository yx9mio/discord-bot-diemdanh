// src/interaction-handlers/setup/setupStatsModal.js
// [FIX-PATH] ../../../services/ và ../../../utils/ (3 cấp, không phải 4)
// [FIX-SEARCH] Hỗ trợ tìm bằng username/displayName
// [FIX-UID] Truyền viewerId để renderToi encode uid vào footer → REFRESH đúng target
'use strict';
const { MessageFlags } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const { getMemberStats, getMemberBadges } = require('../../../services/memberService.js');
const log = require('../../../utils/logger.js');
const { StatsView } = require('../../commands/setup/_views/_StatsView.js');

const XEM_MODAL_ID = 'setup:stats:xem:modal';

class SetupStatsXemModalHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.ModalSubmit });
  }

  parse(interaction) {
    if (interaction.customId === XEM_MODAL_ID) return this.some();
    return this.none();
  }

  async run(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const { guild } = interaction;
    const raw = interaction.fields.getTextInputValue('user_id').trim();
    const extractedId = raw.replace(/[<@!>]/g, '');
    let member = null;

    // Tìm theo User ID trước
    if (/^\d{10,20}$/.test(extractedId)) {
      try { member = await guild.members.fetch(extractedId); } catch { member = null; }
    }

    // Fallback: tìm theo username / displayName
    if (!member) {
      const query = raw.toLowerCase().replace(/^@/, '');
      try {
        const results = await guild.members.search({ query, limit: 5 });
        if (results.size === 1) {
          member = results.first();
        } else if (results.size > 1) {
          member = results.find(m =>
            m.user.username.toLowerCase() === query ||
            (m.displayName ?? '').toLowerCase() === query,
          ) ?? results.first();
        }
      } catch { member = null; }
    }

    if (!member) {
      return interaction.editReply({
        content: [
          `❌ Không tìm thấy **\`${raw}\`** trong server.`,
          '> Nhập **User ID** (chuỗi số) hoặc **username** chính xác.',
          '> Ví dụ: `123456789012345678` hoặc `yx9mio`',
        ].join('\n'),
      });
    }

    const userId = member.id;
    const [stats, badges] = await Promise.all([
      getMemberStats(guild.id, userId).catch(() => null),
      getMemberBadges(guild.id, userId).catch(() => []),
    ]);

    log.info('STATS_XEM', guild.id, '%s xem stats của %s', interaction.user.id, userId);
    // [FIX-UID] Truyền viewerId = interaction.user.id để footer encode uid khi xem người khác
    return interaction.editReply(StatsView.renderToi(stats, member, guild, badges, interaction.user.id));
  }
}

module.exports = { SetupStatsXemModalHandler };
