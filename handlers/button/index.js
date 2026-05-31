// handlers/button/index.js — router tổng hợp toàn bộ button interactions
// Phase G: route admin:override button + admin:override_modal
// Phase I: phiên đóng → edit message gốc với buildClosedSessionEmbed + buttons disabled
'use strict';
const { handleAttend }                                   = require('./attendHandler.js');
const { handleLichsu }                                   = require('./lichsuHandler.js');
const { handleView, handleClose,
        handleConfirmClose, handleCancelClose }           = require('./closeHandler.js');
const { handleSetupShortcut }                            = require('./setupShortcutHandler.js');
const { handleSetupUi }                                  = require('../setupUiHandler.js');
const { handleRefresh }                                  = require('./refreshHandler.js');
const { handleAdminOverride, handleAdminOverrideModal }  = require('./adminOverrideHandler.js');

async function handleButton(interaction) {
  const { customId } = interaction;

  // Setup Wizard
  if (customId?.startsWith('setup:')) return handleSetupUi(interaction);

  // Phân trang lịch sử
  if (customId?.startsWith('lichsu:')) return handleLichsu(interaction);

  // Shortcuts trên setup panel
  if (await handleSetupShortcut(interaction)) return;

  // Confirm/cancel đóng phiên
  if (customId === 'session:confirm_close') return handleConfirmClose(interaction);
  if (customId === 'session:cancel_close')  return handleCancelClose(interaction);

  // Phase G: Admin override
  if (customId === 'admin:override') return handleAdminOverride(interaction);

  // Xem danh sách
  if (customId === 'attend_view')    return handleView(interaction);

  // Đóng phiên (hiện confirm prompt)
  if (customId === 'attend_close')   return handleClose(interaction);

  // Phase UX-A: Làm Mới embed
  if (customId === 'attend_refresh') return handleRefresh(interaction);

  // Nút điểm danh
  return handleAttend(interaction);
}

// Phase G: Modal submit handler — gọi từ interactionCreate cho modalSubmit
async function handleModal(interaction) {
  const { customId } = interaction;
  if (customId === 'admin:override_modal') return handleAdminOverrideModal(interaction);
}

module.exports = { handleButton, handleModal };
