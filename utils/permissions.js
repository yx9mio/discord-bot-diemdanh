// utils/permissions.js
// BUG-7 fix: nhận option { deferred } để dùng editReply thay reply khi đã defer
'use strict';
const { PermissionFlagsBits } = require('discord.js');
const { replyErr, replyErrEdit } = require('./embeds.js');

/**
 * Kiểm tra quyền admin cho interaction.
 * @param {import('discord.js').Interaction} interaction
 * @param {{ context?: string, deferred?: boolean }} opts
 *   - context: mô tả hành động (dùng trong thông báo lỗi)
 *   - deferred: true nếu interaction đã bị defer → dùng editReply thay reply
 */
async function requireAdmin(interaction, opts = {}) {
  const { context = 'thao tác này', deferred = false } = opts;

  // Bot owner bypass (nếu có)
  const ownerId = process.env.BOT_OWNER_ID;
  if (ownerId && interaction.user.id === ownerId) return { ok: true };

  const member = interaction.member;
  if (!member) {
    const msg = `🚫 Lệnh này chỉ dùng trong server.`;
    if (deferred) await interaction.editReply(replyErrEdit(msg));
    else          await interaction.reply({ ...replyErr(msg), ephemeral: true });
    return { ok: false };
  }

  const hasAdmin =
    member.permissions?.has(PermissionFlagsBits.Administrator) ||
    member.permissions?.has(PermissionFlagsBits.ManageGuild);

  if (!hasAdmin) {
    const msg = `🔒 Bạn cần quyền **Administrator** hoặc **Manage Server** để ${context}.`;
    if (deferred) await interaction.editReply(replyErrEdit(msg));
    else          await interaction.reply({ ...replyErr(msg), ephemeral: true });
    return { ok: false };
  }

  return { ok: true };
}

module.exports = { requireAdmin };
