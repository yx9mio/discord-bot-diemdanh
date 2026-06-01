// utils/errorHandler.js
'use strict';
const log = require('./logger.js');
const { replyErr, replyErrEdit } = require('./embeds.js');

let Sentry;
try { Sentry = require('@sentry/node'); } catch (_e) { Sentry = null; }

/**
 * Gửi thông báo lỗi về interaction theo đúng state hiện tại.
 * P5: tự động gửi exception lên Sentry nếu có DSN.
 */
async function handleInteractionError(interaction, err, context = 'unknown') {
  log.error('ERROR_HANDLER', interaction.guild?.id, '[%s] %s', context, err?.message ?? err);

  if (Sentry) {
    try { Sentry.captureException(err, { extra: { context, guildId: interaction.guild?.id } }); }
    catch (_e) { /* Sentry unavailable */ }
  }

  const msg = err?.userMessage ?? '❌ Có lỗi xảy ra. Vui lòng thử lại sau.';
  const fallback = typeof replyErr === 'function'
    ? replyErr(msg)
    : { content: msg, ephemeral: true };

  try {
    if (interaction.deferred)     await interaction.editReply(fallback).catch(() => {});
    else if (interaction.replied) await interaction.followUp(fallback).catch(() => {});
    else                          await interaction.reply(fallback).catch(() => {});
  } catch (_e) { /* hết cách — bỏ qua */ }
}

async function handleCommandError(interaction, err, context = 'command') {
  log.error('ERROR_HANDLER', interaction.guild?.id, '[%s] %s', context, err?.message ?? err);

  if (Sentry) {
    try { Sentry.captureException(err, { extra: { context } }); }
    catch (_e) { /* Sentry unavailable */ }
  }

  const msg = err?.userMessage ?? '❌ Có lỗi xảy ra. Vui lòng thử lại sau.';
  const fallback = typeof replyErrEdit === 'function'
    ? replyErrEdit(msg)
    : { content: msg, ephemeral: true };

  try {
    if (interaction.deferred)     await interaction.editReply(fallback).catch(() => {});
    else if (interaction.replied) await interaction.followUp(fallback).catch(() => {});
    else                          await interaction.reply(fallback).catch(() => {});
  } catch (_e) { /* hết cách — bỏ qua */ }
}

module.exports = { handleInteractionError, handleCommandError };
