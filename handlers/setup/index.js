// handlers/setup/index.js — router cho toàn bộ setup: interactions
'use strict';
const { handleChannelRole } = require('./channelRoleHandler.js');
const { handleLich }        = require('./lichHandler.js');
const { handlePreset }      = require('./presetHandler.js');
const { handlePhien }       = require('./phienHandler.js');
const { handleReminder }    = require('./reminderHandler.js');
const { buildDashboard }    = require('./dashboardHandler.js');
const db                    = require('../../db.js');
const { laAdmin }           = require('../../utils/helpers.js');

async function handleSetupUi(interaction) {
  const { customId, guild, member } = interaction;

  // Admin guard (bỏ qua dashboard + view nút cho user)
  const publicIds = ['setup:dashboard','setup:view:admin','setup:view:user'];
  if (!publicIds.includes(customId) && !customId.startsWith('setup:view:')) {
    const isAdmin = laAdmin(member);
    if (!isAdmin) {
      const msg = { content: '🔒 Chỉ admin mới có thể thao tác mục này.', ephemeral: true };
      if (interaction.deferred || interaction.replied) await interaction.editReply(msg);
      else await interaction.reply(msg);
      return;
    }
  }

  // ── Dashboard & view toggle ──
  if (customId === 'setup:dashboard' || customId === 'setup:view:admin' || customId === 'setup:view:user') {
    const mode = customId === 'setup:view:user' ? 'user' : 'admin';
    if (interaction.isButton()) await interaction.deferUpdate();
    const cfg = await db.getConfig(guild.id);
    const payload = await buildDashboard(guild, cfg, mode);
    await interaction.editReply(payload);
    return;
  }

  // ── Reminder ──
  if (await handleReminder(interaction)) return;

  // ── Channel / Role ──
  if (await handleChannelRole(interaction)) return;

  // ── Lịch cố định ──
  if (await handleLich(interaction)) return;

  // ── Quản lý Phiên ──
  if (await handlePhien(interaction)) return;

  // ── Preset ──
  if (await handlePreset(interaction)) return;

  console.warn('[setupUiHandler] customId không khớp:', customId);
}

module.exports = { handleSetupUi };
