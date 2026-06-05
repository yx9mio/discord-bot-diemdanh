// utils/_views/sessionView.js — STUB (cần điền logic thực)
'use strict';
const { EmbedBuilder } = require('discord.js');

function buildSessionEmbed(session, config = {}) {
  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('📋 Phiên điểm danh')
    .setDescription(session?.title ?? 'Phiên điểm danh')
    .setTimestamp();
}

function buildClosedSessionEmbed(session, config = {}) {
  return new EmbedBuilder()
    .setColor(0x95A5A6)
    .setTitle('🔒 Phiên đã kết thúc')
    .setDescription(session?.title ?? 'Phiên điểm danh')
    .setTimestamp();
}

module.exports = { buildSessionEmbed, buildClosedSessionEmbed };
