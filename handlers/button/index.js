// handlers/button/index.js — router tổng hợp toàn bộ button interactions
'use strict';
const { handleAttend }                                   = require('./attendHandler.js');
const { handleLichsu }                                   = require('./lichsuHandler.js');
const { handleView, handleClose,
        handleConfirmClose, handleCancelClose }           = require('./closeHandler.js');
const { handleSetupShortcut }                            = require('./setupShortcutHandler.js');
const { handleSetupUi }                                  = require('../setupUiHandler.js');

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

  // Xem danh sách
  if (customId === 'attend_view')  return handleView(interaction);

  // Đóng phiên (hiện confirm prompt)
  if (customId === 'attend_close') return handleClose(interaction);

  // Nút điểm danh
  return handleAttend(interaction);
}

module.exports = { handleButton };
