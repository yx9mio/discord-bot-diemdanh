// handlers/button/index.js — router tổng hợp toàn bộ button interactions
'use strict';
const { handleAttend }                                   = require('./attendHandler.js');
const { handleLichsu }                                   = require('./lichsuHandler.js');
const { handleView, handleClose,
        handleConfirmClose, handleCancelClose }           = require('./closeHandler.js');
const { handleSetupShortcut }                            = require('./setupShortcutHandler.js');
const { handleSetupUi }                                  = require('../setupUiHandler.js');
const { handleRefresh }                                  = require('./refreshHandler.js');
const { handleAdminOverride, handleAdminOverrideModal }  = require('./adminOverrideHandler.js');
const { handleUpgradeConfirm }                           = require('./upgradeHandler.js');

async function handleButton(interaction) {
  const { customId } = interaction;

  if (customId?.startsWith('setup:')) return handleSetupUi(interaction);
  if (customId?.startsWith('lichsu:')) return handleLichsu(interaction);
  if (await handleSetupShortcut(interaction)) return;

  if (customId === 'session:confirm_close') return handleConfirmClose(interaction);
  if (customId === 'session:cancel_close')  return handleCancelClose(interaction);
  if (customId === 'admin:override')        return handleAdminOverride(interaction);
  if (customId === 'upgrade:confirm')       return handleUpgradeConfirm(interaction);
  if (customId === 'attend_view')           return handleView(interaction);
  if (customId === 'attend_close')          return handleClose(interaction);
  if (customId === 'attend_refresh')        return handleRefresh(interaction);

  return handleAttend(interaction);
}

// Modal submit handler — gọi từ interactionCreate cho modalSubmit
function handleModal(interaction) {
  const { customId } = interaction;
  if (customId === 'admin:override_modal') return handleAdminOverrideModal(interaction);
}

module.exports = { handleButton, handleModal };
