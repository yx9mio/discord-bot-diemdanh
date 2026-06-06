// src/interaction-handlers/setup/setupStatsModal.js
// Handles: setup:stats:xem:modal (ModalSubmit) — xem thống kê thành viên cụ thể
// [FIX-PATH] ../../../services/ → ../../../../services/ (file nằm 4 cấp sâu)
// [FIX-SEARCH] Hỗ trợ tìm bằng: userId, username, displayName (không chỉ ID)
// [FIX-PERM] Bỏ requireAdmin — mọi thành viên đều có thể xem stats người khác
'use strict';
const { MessageFlags } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const { getMemberStats, getMemberBadges } = require('../../../../services/memberService.js');
const log = require('../../../../utils/logger.js');
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

    // Bóc tách ID từ <@ID>, <@!ID> hoặc số thuần
    const extractedId = raw.replace(/[<@!>]/g, '');

    let member = null;

    // 1️⃣ Nếu là ID (chuỗi số thuần), fetch trực tiếp
    if (/^\d{10,20}$/.test(extractedId)) {
      try { member = await guild.members.fetch(extractedId); } catch { member = null; }
    }

    // 2️⃣ Nếu không tìm được bằng ID, thử tìm bằng username / displayName
    if (!member) {
      const query = raw.toLowerCase().replace(/^@/, '');
      try {
        // Fetch tất cả member trong guild để tìm theo tên
        // fetchAll chỉ khả thi với guild nhỏ; với guild lớn dùng searchGuildMembers
        const results = await guild.members.search({ query, limit: 5 });
        if (results.size === 1) {
          member = results.first();
        } else if (results.size > 1) {
          // Nhiều kết quả — tìm chính xác hơn
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
          '> Ờ: Nhập **User ID** (chuỗi số) hoặc **username** chính xác của thành viên.',
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
    return interaction.editReply(StatsView.renderToi(stats, member, guild, badges));
  }
}

module.exports = { SetupStatsXemModalHandler };
