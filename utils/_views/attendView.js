// utils/_views/attendView.js — STUB (cần điền logic thực)
'use strict';
const { EmbedBuilder } = require('discord.js');

function buildAttendConfirmEmbed(data = {}) {
  return new EmbedBuilder()
    .setColor(0x3498DB)
    .setTitle('✅ Xác nhận điểm danh')
    .setTimestamp();
}

function buildAdminOverrideSuccessEmbed(data = {}) {
  return new EmbedBuilder()
    .setColor(0xF39C12)
    .setTitle('🔧 Admin đã cập nhật điểm danh')
    .setTimestamp();
}

module.exports = { buildAttendConfirmEmbed, buildAdminOverrideSuccessEmbed };
