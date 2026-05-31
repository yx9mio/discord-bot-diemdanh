// handlers/button/index.js — router tổng hợp toàn bộ button interactions
'use strict';
const { handleAttend }         = require('./attendHandler.js');
const { handleLichsu }         = require('./lichsuHandler.js');
const { handleView, handleClose } = require('./closeHandler.js');
const { handleSetupShortcut }  = require('./setupShortcutHandler.js');
const { handleSetupUi }        = require('../setupUiHandler.js');

async function handleButton(interaction) {
  const { customId } = interaction;

  // Setup Wizard — delegated to setupUiHandler
  if (customId?.startsWith('setup:')) return handleSetupUi(interaction);

  // Phân trang lịch sử
  if (customId?.startsWith('lichsu:')) return handleLichsu(interaction);

  // Shortcuts trên setup panel (setup_help, setup_config)
  if (await handleSetupShortcut(interaction)) return;

  // Xem danh sách
  if (customId === 'attend_view') return handleView(interaction);

  // Đóng phiên
  if (customId === 'attend_close') return handleClose(interaction);

  // Nút điểm danh
  return handleAttend(interaction);
}

module.exports = { handleButton };
