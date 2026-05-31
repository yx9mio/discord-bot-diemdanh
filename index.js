// index.js — Entry point Quản Gia
// M-5: interactionCreate logic tách sang events/interactionCreate.js
require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { loadCommands }          = require('./handlers/commandHandler.js');
const { onReady }               = require('./events/ready.js');
const { onGuildCreate }         = require('./events/guildCreate.js');
const { onMessageDelete }       = require('./events/messageDelete.js');
const { execute: onInteractionCreate } = require('./events/interactionCreate.js');
const log                       = require('./utils/logger.js');

if (!process.env.DISCORD_TOKEN) {
  log.error('SYSTEM', null, 'Thiếu DISCORD_TOKEN trong .env!');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel],
});

const commands = loadCommands();

client.once('ready',           ()      => onReady(client));
client.on('guildCreate',       guild   => onGuildCreate(guild));
client.on('messageDelete',     message => onMessageDelete(client, message));
client.on('interactionCreate', i       => onInteractionCreate(i, commands));

client.login(process.env.DISCORD_TOKEN);
