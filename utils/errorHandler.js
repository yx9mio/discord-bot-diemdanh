// utils/errorHandler.js — Centralized interaction error handler
// Usage:
//   const { handleInteractionError } = require('./utils/errorHandler.js');
//   await handleInteractionError(interaction, err);
//   await handleInteractionError(interaction, err, 'CMD /batdau');

const log = require('./logger.js');
const { replyErr, replyErrEdit } = require('./embeds.js');

/**
 * Gửi thông báo lỗi về interaction theo đúng state hiện tại:
 *   deferred → editReply   (replyErrEdit — clear components)
 *   replied  → followUp   (replyErr     — ephemeral)
 *   fresh    → reply      (replyErr     — ephemeral)
 *
 * @param {import('discord.js').Interaction} interaction
 * @param {Error} err
 * @param {string} [context]  — optional tag cho log, VD: 'CMD /batdau'
 */
async function handleInteractionError(interaction, err, context = 'unknown') {
  const guildId = interaction.guildId ?? null;
  const tag     = context ? `[${context}]` : '';

  log.error('ERR_HANDLER', guildId, '%s %s', tag, err.stack ?? err.message);

  try {
    if (interaction.deferred) {
      // Đã defer → editReply để thay thế loading embed
      await interaction.editReply(replyErrEdit('Có lỗi xảy ra. Vui lòng thử lại.'));
    } else if (interaction.replied) {
      // Đã reply rồi → followUp ephemeral
      await interaction.followUp({ ...replyErr('Có lỗi xảy ra. Vui lòng thử lại.'), ephemeral: true });
    } else {
      // Chưa reply → reply mới
      await interaction.reply(replyErr('Có lỗi xảy ra. Vui lòng thử lại.'));
    }
  } catch (replyErr_) {
    // Nếu reply chính thất bại (interaction expired, v.v.) — log thêm, không crash
    log.warn('ERR_HANDLER', guildId, '%s Không thể gửi error reply: %s', tag, replyErr_.message);
    // Last-resort plain content
    try {
      const fallback = { content: '❌ Có lỗi xảy ra. Vui lòng thử lại.', ephemeral: true };
      if (interaction.deferred)       await interaction.editReply(fallback).catch(() => {});
      else if (interaction.replied)   await interaction.followUp(fallback).catch(() => {});
      else                            await interaction.reply(fallback).catch(() => {});
    } catch (_) { /* hết cách — bỏ qua */ }
  }
}

module.exports = { handleInteractionError };
