// utils/permissions.js — Centralized permission guard (Phase 7.3)
'use strict';
const { PermissionFlagsBits } = require('discord.js');
const db = require('../db.js');
const { replyErr, replyErrEdit } = require('./embeds.js');
const { laAdmin } = require('./helpers.js');

/**
 * requireAdmin(interaction, opts?)
 *
 * Kiểm tra quyền admin / role được cấu hình.
 * - Tự detect state: fresh / deferred / replied
 * - Return { ok: true, cfg }  → caller tiếp tục execute
 * - Return { ok: false }      → đã reply lỗi, caller return sớm
 *
 * @param {import('discord.js').Interaction} interaction
 * @param {object} [opts]
 * @param {boolean} [opts.cfgRequired=true]   — cần load cfg để check laAdmin
 * @param {string}  [opts.context='lệnh này'] — tên lệnh cho message lỗi
 * @param {object}  [opts.cfg]                — truyền cfg sẵn để tránh query 2 lần
 * @returns {Promise<{ ok: boolean, cfg?: object }>}
 */
async function requireAdmin(interaction, opts = {}) {
  const { cfgRequired = true, context = 'lệnh này', cfg: passedCfg } = opts;

  // 1. Luôn phải trong guild
  if (!interaction.guild) {
    await _reply(interaction, replyErr('❌ Lệnh này chỉ dùng được trong server.'));
    return { ok: false };
  }

  // 2. Hard check: Discord Administrator permission (bỏ qua cfg)
  const hasDiscordAdmin = interaction.member?.permissions?.has(PermissionFlagsBits.Administrator);

  // 3. Load cfg nếu cần kiểm tra custom admin roles
  let cfg = passedCfg;
  if (cfgRequired && !cfg) {
    cfg = await db.getConfig(interaction.guild.id);
  }

  // 4. laAdmin check (bao gồm admin_role_ids từ cfg)
  const allowed = hasDiscordAdmin || (cfgRequired && cfg && laAdmin(interaction.member, cfg));

  if (!allowed) {
    const msg = `🔒 Bạn không có quyền dùng ${context}.`;
    await _reply(interaction, replyErr(msg), replyErrEdit(msg));
    return { ok: false, cfg };
  }

  return { ok: true, cfg };
}

/**
 * requireGuild(interaction)
 * Guard đơn giản: chỉ kiểm tra interaction trong guild.
 * Dùng cho các command không cần admin nhưng cần guild context.
 * @returns {Promise<boolean>}
 */
async function requireGuild(interaction) {
  if (!interaction.guild) {
    await _reply(interaction, replyErr('❌ Lệnh này chỉ dùng được trong server.'));
    return false;
  }
  return true;
}

// ─── Internal helper ─────────────────────────────────────────────────────────

/**
 * Auto-detect deferred / replied / fresh state rồi reply đúng cách.
 * @param {import('discord.js').Interaction} interaction
 * @param {object} freshPayload   — dùng khi chưa deferred/replied
 * @param {object} [editPayload]  — dùng khi đã deferred (editReply)
 */
async function _reply(interaction, freshPayload, editPayload) {
  try {
    if (interaction.deferred) {
      await interaction.editReply(editPayload ?? freshPayload);
    } else if (interaction.replied) {
      await interaction.followUp({ ...freshPayload, ephemeral: true });
    } else {
      await interaction.reply({ ...freshPayload, ephemeral: true });
    }
  } catch {
    // Interaction expired hoặc đã bị handle — im lặng
  }
}

module.exports = { requireAdmin, requireGuild };
