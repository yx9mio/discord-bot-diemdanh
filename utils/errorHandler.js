// utils/errorHandler.js — Centralized interaction error handler
'use strict';
const { MessageFlags } = require('discord.js');
const log = require('./logger.js');
const { replyErr, replyErrEdit } = require('./embeds.js');

let Sentry;
try { Sentry = require('@sentry/node'); } catch (_) { Sentry = null; }

/**
 * Gửi thông báo lỗi về interaction theo đúng state hiện tại.
 * P5: tự động gửi exception lên Sentry nếu có DSN.
 */
async function handleInteractionError(interaction, err, context = 'unknown') {
  const guildId = interaction.guildId ?? null;
  const tag     = context ? `[${context}]` : '';

  log.error('ERR_HANDLER', guildId, '%s %s', tag, err.stack ?? err.message);

  // P5: report lên Sentry với context guild
  if (Sentry && process.env.SENTRY_DSN) {
    Sentry.withScope((scope) => {
      scope.setTag('guildId', guildId ?? 'unknown');
      scope.setTag('context', context);
      scope.setExtra('commandName', interaction.commandName ?? interaction.customId ?? null);
      Sentry.captureException(err);
    });
  }

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
    try {
      const fallback = { content: '❌ Có lỗi xảy ra. Vui lòng thử lại.', flags: MessageFlags.Ephemeral };
      if (interaction.deferred)     await interaction.editReply(fallback).catch(() => {});
      else if (interaction.replied) await interaction.followUp(fallback).catch(() => {});
      else                          await interaction.reply(fallback).catch(() => {});
    } catch (_) { /* hết cách — bỏ qua */ }
  }
}

module.exports = { handleInteractionError };
