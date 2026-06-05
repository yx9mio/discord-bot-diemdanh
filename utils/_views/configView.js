// utils/_views/configView.js — STUB (cần điền logic thực)
'use strict';
const { EmbedBuilder } = require('discord.js');

function buildConfigEmbed(config = {}) {
  return new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle('⚙️ Cấu hình server')
    .setTimestamp();
}

module.exports = { buildConfigEmbed };
