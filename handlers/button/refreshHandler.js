// handlers/button/refreshHandler.js — Phase UX-A: Làm Mới embed điểm danh
'use strict';
const db  = require('../../db.js');
const log = require('../../utils/logger.js');
const { buildSessionEmbed, buildAttendanceButtons, replyErr } = require('../../utils/embeds.js');

async function handleRefresh(interaction) {
  await interaction.deferUpdate();

  try {
    const session = await db.getActiveSession(interaction.guildId);
    if (!session) {
      await interaction.followUp({ ...replyErr('Không có phiên điểm danh đang mở.'), ephemeral: true });
      return;
    }

    const attended = await db.getAttendances(session.id);
    await interaction.guild.members.fetch().catch(() => {});

    const phaiRoleIds = session.phai_role_ids ?? [];
    const embed = await buildSessionEmbed(interaction.guild, session, attended, phaiRoleIds);
    const row   = buildAttendanceButtons(false);

    await interaction.editReply({ embeds: [embed], components: [row] });
    log.info('REFRESH', interaction.guildId, '%s làm mới embed điểm danh', interaction.user.tag);
  } catch (e) {
    log.error('REFRESH', interaction.guildId, 'Lỗi handleRefresh: %s', e.message);
    await interaction.followUp({ ...replyErr('Không thể làm mới, thử lại sau.'), ephemeral: true });
  }
}

module.exports = { handleRefresh };
