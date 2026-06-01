// utils/errorHandler.js — Centralized interaction error handler
// Fix E-1: ephemeral → MessageFlags.Ephemeral
'use strict';
const { MessageFlags } = require('discord.js');
const log = require('./logger.js');
const { replyErr, replyErrEdit } = require('./embeds.js');

/**
 * Gửi thông báo lỗi về interaction theo đúng state hiện tại:
 *   deferred → editReply   (replyErrEdit — clear components)
 *   replied  → followUp   (replyErr     — ephemeral)
 *   fresh    → reply      (replyErr     — ephemeral)
 */
async function handleInteractionError(interaction, err, context = 'unknown') {
  const guildId = interaction.guildId ?? null;
  const tag     = context ? `[${context}]` : '';

  log.error('ERR_HANDLER', guildId, '%s %s', tag, err.stack ?? err.message);

  try {
    if (interaction.deferred) {
      await interaction.editReply(replyErrEdit('Có lỗi xảy ra. Vui lòng thử lại.'));
    } else if (interaction.replied) {
      await interaction.followUp(replyErr('Có lỗi xảy ra. Vui lòng thử lại.'));
    } else {
      await interaction.reply(replyErr('Có lỗi xảy ra. Vui lòng thử lại.'));
    }
  } catch (replyErr_) {
    log.warn('ERR_HANDLER', guildId, '%s Không thể gửi error reply: %s', tag, replyErr_.message);
    // Last-resort plain content
    try {
      const fallback = { content: '❌ Có lỗi xảy ra. Vui lòng thử lại.', flags: MessageFlags.Ephemeral };
      if (interaction.deferred)       await interaction.editReply(fallback).catch(() => {});
      else if (interaction.replied)   await interaction.followUp(fallback).catch(() => {});
      else                            await interaction.reply(fallback).catch(() => {});
    } catch (_) { /* hết cách — bỏ qua */ }
  }
}

module.exports = { handleInteractionError };
