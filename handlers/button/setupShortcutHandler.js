// handlers/button/setupShortcutHandler.js — các nút shortcut trên setup panel
'use strict';
const db = require('../../db.js');
const { buildConfigEmbed } = require('../../utils/embeds.js');

async function handleSetupShortcut(interaction) {
  const { customId, guild } = interaction;

  if (customId === 'setup_help') {
    const { execute } = require('../../commands/help.js');
    await execute(interaction);
    return true;
  }

  if (customId === 'setup_config') {
    await interaction.deferReply({ ephemeral: true });
    const cfg = await db.getConfig(guild.id);
    await interaction.editReply({ embeds: [buildConfigEmbed(cfg)] });
    return true;
  }

  return false;
}

module.exports = { handleSetupShortcut };
