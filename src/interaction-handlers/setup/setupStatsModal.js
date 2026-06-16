// src/interaction-handlers/setup/setupStatsModal.js
// [FIX-PATH] ../../../services/ và ../../../utils/ (3 cấp, không phải 4)
// [FIX-SEARCH] Hỗ trợ tìm bằng username/displayName
// [FIX-UID] Truyền viewerId vào renderToi để footer encode uid (REFRESH biết target)
'use strict';
const { MessageFlags } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const { getMemberStats, getMemberBadges } = require('../../../services/memberService.js');
const { getAttendancesByUser } = require('../../../services/attendanceService.js');
const log = require('../../../utils/logger.js');
const { replyErrEdit } = require('../../../utils/embeds.js');
const { StatsView } = require('../../commands/setup/_views/_StatsView.js');
const { wrapHandler } = require('../../../utils/error-boundary.js');
const { checkCooldown } = require('../../../utils/cooldown.js');

const MODAL_ID = 'setup:stats:xem:modal';

class SetupStatsModalHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.ModalSubmit });
  }

  parse(interaction) {
    if (interaction.customId === MODAL_ID) return this.some();
    return this.none();
  }

  async run(interaction) {
    return wrapHandler(async (interaction) => {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (!checkCooldown(interaction.user.id, 'stats_xem_modal', 1000)) return interaction.editReply({ content: '⏳ Vui lòng đợi một chút...' });
    const { guild } = interaction;

    try {
      const raw = interaction.fields.getTextInputValue('user_id').trim();
      // Hỗ trợ <@id>, id thuần, hoặc username
      const idMatch = raw.match(/(\d{10,20})/);
      let targetUserId = idMatch ? idMatch[1] : null;

      // Nếu không có ID, tìm theo displayName trong cache
      if (!targetUserId) {
        const lower = raw.replace(/^@/, '').toLowerCase();
        const found = guild.members.cache.find(
          m => m.displayName.toLowerCase() === lower || m.user.username.toLowerCase() === lower
        );
        if (found) targetUserId = found.id;
      }

      if (!targetUserId) {
        return interaction.editReply(replyErrEdit('Không tìm thấy thành viên. Nhập User ID (số) hoặc @username chính xác.'));
      }

      const [stats, badges, records] = await Promise.all([
        getMemberStats(guild.id, targetUserId),
        getMemberBadges(guild.id, targetUserId),
        getAttendancesByUser(guild.id, targetUserId).then(r => Array.isArray(r) ? r.slice(0, 10) : []),
      ]);

      let member;
      try { member = await guild.members.fetch(targetUserId); } catch { member = null; }

      // [FIX] Truyền viewerId = interaction.user.id → renderToi encode uid:targetUserId vào footer
      // → REFRESH sau này đọc được uid để reload đúng target
      return interaction.editReply(
        StatsView.renderToi(stats, member, guild, badges, interaction.user.id, null, records)
      );
    } catch (e) {
      log.error('STATS_MODAL', guild?.id, 'xem người khác thất bại: %s', e.message);
      return interaction.editReply(replyErrEdit('Không thể tải BXH, thử lại sau.'));
    }
  }, 'SetupStatsModalHandler')(interaction); }
}

module.exports = { SetupStatsModalHandler };
