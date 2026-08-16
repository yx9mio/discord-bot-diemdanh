'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const { DateTime } = require('luxon');
const { getTopMembers, getTopMembersByPeriod, getDistinctPhongBan } = require('../../../services/memberService.js');
const { getGuildConfig } = require('../../../services/configService.js');
const log = require('../../../utils/logger.js');
const { StatsView } = require('../../commands/setup/_views/_StatsView.js');
const { wrapHandler } = require('../../../utils/error-boundary.js');
const { checkCooldown } = require('../../../utils/cooldown.js');

// [FIX] Giữ context phái + period khi lọc phòng ban (đọc từ footer của rank view)
function _readRankContext(interaction) {
  try {
    const footer = interaction.message?.embeds?.[0]?.footer?.text ?? '';
    const phaiM = footer.match(/phai:(\d+)/);
    const periodM = footer.match(/rank_period:(\w+)/);
    return {
      filterPhaiRoleId: phaiM ? phaiM[1] : '',
      period: periodM ? periodM[1] : 'all',
    };
  } catch {
    return { filterPhaiRoleId: '', period: 'all' };
  }
}

class SetupStatsPhongBanHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.SelectMenu });
  }

  parse(interaction) {
    if (interaction.customId === StatsView.CUSTOM_ID.PHONG_BAN_SELECT) return this.some();
    return this.none();
  }

  async run(interaction) {
    return wrapHandler(async (interaction) => {
    await interaction.deferUpdate();
    if (!checkCooldown(interaction.user.id, 'stats_pb_filter', 1000)) return interaction.editReply({ content: '⏳ Vui lòng đợi một chút...' });
    const { guild } = interaction;
    const selectedPhongBan = interaction.values[0] === '__all' ? '' : interaction.values[0];
    const { filterPhaiRoleId, period } = _readRankContext(interaction);

    try {
      let top;
      if (period === 'all') {
        top = await getTopMembers(guild.id, 10, selectedPhongBan || null, filterPhaiRoleId || null);
      } else {
        const now = DateTime.now();
        let startDate, endDate;
        if (period === 'month') {
          startDate = now.startOf('month').toISO();
          endDate = now.plus({ months: 1 }).startOf('month').toISO();
        } else {
          const seasonMonth = Math.floor((now.month - 1) / 3) * 3 + 1;
          const seasonStart = DateTime.local(now.year, seasonMonth, 1);
          startDate = seasonStart.toISO();
          endDate = seasonStart.plus({ months: 3 }).toISO();
        }
        top = await getTopMembersByPeriod(guild.id, startDate, endDate, 10);
        if (selectedPhongBan) top = top.filter(r => r.phong_ban === selectedPhongBan);
        if (filterPhaiRoleId) top = top.filter(r => r.phai_role_ids?.includes(filterPhaiRoleId));
      }
      const [pbList, cfg] = await Promise.all([
        getDistinctPhongBan(guild.id),
        getGuildConfig(guild.id),
      ]);
      return interaction.editReply(await StatsView.renderRank(top, guild, 10, pbList, selectedPhongBan, cfg, filterPhaiRoleId, period));
    } catch (e) {
      log.error('SETUP_STATS_PB', guild.id, 'phòng ban filter thất bại: %s', e.message);
      return interaction.editReply({ content: '❌ Không thể lọc theo phòng ban, thử lại sau.', embeds: [], files: [] });
    }
  }, 'SetupStatsPhongBanHandler')(interaction); }
}

module.exports = { SetupStatsPhongBanHandler };
