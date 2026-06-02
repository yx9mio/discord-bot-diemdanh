// interaction-handlers/historyNav.js
// Handles: history:prev, history:next
// Phân trang cho /lichsu — đọc lại từ DB, không lưu state trong memory
'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const db = require('../db.js');
const { buildHistoryNavRow } = require('../utils/embeds.js');
const { buildHistoryEmbed, PAGE_SIZE } = require('../src/commands/stats/lichsu.js');

const HISTORY_CMDS = new Set(['history:prev', 'history:next']);

class HistoryNavHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    if (HISTORY_CMDS.has(interaction.customId)) return this.some();
    return this.none();
  }

  async run(interaction) {
    await interaction.deferUpdate();
    const { guild, customId, message } = interaction;

    const curPage  = readPageFromFooter(message.embeds?.[0]?.footer?.text);
    const newPage0 = customId === 'history:next' ? curPage + 1 : curPage - 1;

    const all = await db.getSessionHistory(guild.id, 100);
    if (!all.length) {
      return interaction.editReply({ content: 'Chưa có phiên nào.', embeds: [], components: [] });
    }
    const totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
    const page       = Math.max(0, Math.min(newPage0, totalPages - 1));
    const slice      = all.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    const embed      = buildHistoryEmbed(slice, page, totalPages, `${all.length} phiên gần nhất`);
    const row        = totalPages > 1 ? buildHistoryNavRow(page + 1, totalPages) : null;

    await interaction.editReply({
      embeds: [embed],
      components: row ? [row] : [],
    });
  }
}

function readPageFromFooter(text) {
  if (!text) return 0;
  const m = text.match(/Trang\s+(\d+)\/(\d+)/i);
  if (!m) return 0;
  return Math.max(0, parseInt(m[1], 10) - 1);
}

module.exports = { HistoryNavHandler };
