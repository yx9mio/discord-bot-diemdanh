// handlers/setup/timezoneHandler.js
// Stub placeholder — chức năng timezone chưa implement
'use strict';

/**
 * handleTimezone — xử lý setup:timezone_* interactions
 * @param {import('discord.js').Interaction} interaction
 * @returns {Promise<boolean>} true nếu đã xử lý, false nếu không phải interaction này
 */
async function handleTimezone(interaction) {
  const { customId } = interaction;
  if (!customId || !customId.startsWith('setup:timezone')) return false;

  // TODO: implement timezone setup UI
  return false;
}

module.exports = { handleTimezone };
