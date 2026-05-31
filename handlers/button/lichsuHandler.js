// handlers/button/lichsuHandler.js — phân trang /lich_su
'use strict';
const db = require('../../db.js');

async function handleLichsu(interaction) {
  const { customId, guild } = interaction;
  if (!customId?.startsWith('lichsu:')) return false;

  const parts    = customId.split(':');
  const action   = parts[1];
  const curPage  = parseInt(parts[2], 10);
  const newPage  = action === 'next' ? curPage + 1 : curPage - 1;

  await interaction.deferUpdate();
  const { buildHistoryPageEmbed, buildNavRow, PAGE_SIZE } = require('../../commands/lichsu.js');
  const history    = await db.getSessionHistory(guild.id, 50);
  const totalPages = Math.max(1, Math.ceil(history.length / PAGE_SIZE));
  const clampedPage = Math.max(0, Math.min(newPage, totalPages - 1));
  const embed = buildHistoryPageEmbed(history, clampedPage, totalPages);
  const row   = buildNavRow(clampedPage, totalPages);
  await interaction.editReply({ embeds: [embed], components: totalPages > 1 ? [row] : [] });
  return true;
}

module.exports = { handleLichsu };
