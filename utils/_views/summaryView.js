// utils/_views/summaryView.js — STUB (cần điền logic thực)
'use strict';
const { EmbedBuilder } = require('discord.js');

function buildSummaryEmbed(data = {}) {
  return new EmbedBuilder()
    .setColor(0x2ECC71)
    .setTitle('📊 Tổng kết điểm danh')
    .setTimestamp();
}

module.exports = { buildSummaryEmbed };
