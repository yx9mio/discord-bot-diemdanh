// handlers/setup/index.js — điều phối tất cả setup:* interactions
'use strict';
const { handleChannel, handleRole, handlePhai } = require('./channelRoleHandler.js');
const { handleTimezone }  = require('./timezoneHandler.js');
const { handlePhien }     = require('./phienHandler.js');
const { handleLich }      = require('./lichHandler.js');
const { handlePreset }    = require('./presetHandler.js');
const { buildDashboard }  = require('./dashboardHandler.js');
const log = require('../../utils/logger.js');

async function handleSetupUi(interaction) {
  const { customId } = interaction;

  // ── Dashboard ──
  if (customId === 'setup:dashboard') {
    await interaction.deferUpdate().catch(() => {});
    const dash = await buildDashboard(interaction.guild);
    await interaction.editReply(dash);
    return;
  }

  // ── Channel / Role / Phái ──
  if (await handleChannel(interaction))  return;
  if (await handleRole(interaction))     return;
  if (await handlePhai(interaction))     return;

  // ── Timezone ──
  if (await handleTimezone(interaction)) return;

  // ── Phiên ──
  if (await handlePhien(interaction))    return;

  // ── Lịch cố định ──
  if (await handleLich(interaction))     return;

  // ── Preset ──
  if (await handlePreset(interaction))   return;

  log.warn('SETUP', interaction.guild?.id, 'customId không khớp: %s', customId);
}

module.exports = { handleSetupUi };
