// events/guildCreate.js — Phase 11.1
// Khi bot join guild mới: đăng ký slash commands ngay, không cần restart
'use strict';
const { REST, Routes } = require('discord.js');
const path = require('path');
const fs   = require('fs');
const log  = require('../utils/logger.js');

async function onGuildCreate(guild) {
  const dir   = path.join(__dirname, '..', 'commands');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
  const body  = files.map(f => require(path.join(dir, f)).data.toJSON());

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(
      Routes.applicationGuildCommands(guild.client.user.id, guild.id),
      { body },
    );
    log.info('SYSTEM', guild.id, 'guildCreate: đã đăng ký %s commands cho "%s"', body.length, guild.name);
  } catch (err) {
    log.error('SYSTEM', guild.id, 'guildCreate: lỗi đăng ký commands cho "%s": %s', guild.name, err.message);
  }
}

module.exports = { onGuildCreate };
