// utils/helpers.js — shared utilities
'use strict';
const { EmbedBuilder } = require('discord.js');
const db  = require('../db.js');
const log = require('./logger.js');
const { FOOTER_DEFAULT } = require('./embeds.js');

// ─── Format số ────────────────────────────────────────────────────────────────
function formatNumber(n) {
  if (n == null) return '0';
  return new Intl.NumberFormat('vi-VN').format(n);
}

// ─── Format thời gian ─────────────────────────────────────────────────────────
function formatDuration(totalMin) {
  if (!totalMin || totalMin <= 0) return 'N/A';
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h} giờ ${m} phút` : `${h} giờ`;
}

// ─── Tìm kênh thông báo ────────────────────────────────────────────────────────
function timKenhThongBao(guild) {
  try {
    const cfg = db.getConfigSync?.(guild.id);
    if (cfg?.channel_id) {
      const ch = guild.channels.cache.get(cfg.channel_id);
      if (ch && ch.permissionsFor(guild.members.me)?.has('SendMessages')) return cfg.channel_id;
    }
  } catch (_e) { /* bỏ qua */ }
  if (guild.systemChannelId) {
    const ch = guild.channels.cache.get(guild.systemChannelId);
    if (ch && ch.permissionsFor(guild.members.me)?.has('SendMessages')) return guild.systemChannelId;
  }
  const textCh = guild.channels.cache.find(
    c => c.isTextBased() && !c.isThread() && c.permissionsFor(guild.members.me)?.has('SendMessages'),
  );
  return textCh?.id ?? null;
}

// ─── Reply helper ──────────────────────────────────────────────────────────────
async function safeReply(interaction, options) {
  try {
    if (interaction.deferred)     return await interaction.editReply(options);
    if (interaction.replied)      return await interaction.followUp({ ...options, ephemeral: true });
    return await interaction.reply({ ...options, ephemeral: true });
  } catch (e) {
    log.error('HELPERS', interaction.guild?.id, 'safeReply failed: %s', e.message);
  }
}

// ─── Build thông báo lỗi chung ─────────────────────────────────────────────────
function buildErrorEmbed(message) {
  return new EmbedBuilder()
    .setColor(0xE74C3C)
    .setDescription(`❌ ${message}`)
    .setFooter({ text: FOOTER_DEFAULT });
}

module.exports = { formatNumber, formatDuration, timKenhThongBao, safeReply, buildErrorEmbed };
