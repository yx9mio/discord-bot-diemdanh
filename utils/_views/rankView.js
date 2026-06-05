// utils/_views/rankView.js — STUB (cần điền logic thực)
'use strict';
const { EmbedBuilder } = require('discord.js');

function buildRankEmbed(data = {}) {
  return new EmbedBuilder()
    .setColor(0xF1C40F)
    .setTitle('🏆 Bảng xếp hạng')
    .setTimestamp();
}

module.exports = { buildRankEmbed };
