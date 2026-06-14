// utils/permissions.js
// BUG-7 fix: nhận option { deferred } để dùng editReply thay reply khi đã defer
'use strict';
const { MessageFlags, PermissionFlagsBits } = require('discord.js');
const { replyErr, replyErrEdit } = require('./embeds.js');
const { getGuildConfig } = require('../services/configService.js'); // [FIX] db.js → configService
const log = require('./logger.js');
const { auditLog } = require('./auditLog.js');

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
  if (ownerId && interaction.user.id === ownerId) {
    log.warn('PERM', interaction.guild?.id, 'BOT_OWNER_ID bypass — user=%s guild=%s action=%s', interaction.user.id, interaction.guild?.id, context);
    auditLog({ guildId: interaction.guild?.id, actorId: interaction.user.id, action: 'OWNER_BYPASS', metadata: { context } }).catch(() => {});
    return { ok: true };
  }

  const member = interaction.member;
  if (!member) {
    const msg = `🚫 Lệnh này chỉ dùng trong server.`;
    if (deferred) await interaction.editReply(replyErrEdit(msg));
    else          await interaction.reply({ ...replyErr(msg), flags: MessageFlags.Ephemeral });
    return { ok: false };
  }

  // Admin / ManageGuild luôn được quyền
  const hasPermission =
    member.permissions?.has(PermissionFlagsBits.Administrator) ||
    member.permissions?.has(PermissionFlagsBits.ManageGuild);
  if (hasPermission) return { ok: true };

  // Kiểm tra admin_role_id từ config
  try {
    const cfg = await getGuildConfig(interaction.guildId);
    if (cfg?.admin_role_id && member.roles.cache.has(cfg.admin_role_id)) return { ok: true };
  } catch (_) { /* fallthrough */ }

  const msg = `🔒 Bạn cần quyền **Administrator**, **Manage Server** hoặc role quản lý để ${context}.`;
  if (deferred) await interaction.editReply(replyErrEdit(msg));
  else          await interaction.reply({ ...replyErr(msg), flags: MessageFlags.Ephemeral });
  return { ok: false };
}

module.exports = { requireAdmin };
