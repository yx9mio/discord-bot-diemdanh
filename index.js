// index.js — Entry point Quản Gia
require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { loadCommands, handleCommand } = require('./handlers/commandHandler.js');
const { handleButton }  = require('./handlers/buttonHandler.js');
const { onReady }       = require('./events/ready.js');
const { onMessageDelete } = require('./events/messageDelete.js');
const { handleSelectMenu } = require('./commands/help.js');

if (!process.env.DISCORD_TOKEN) {
  console.error('[LỖI] Thiếu DISCORD_TOKEN trong .env!');
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

client.once('ready', () => onReady(client));

client.on('interactionCreate', async interaction => {
  if (interaction.isButton())             return handleButton(interaction);
  if (interaction.isStringSelectMenu())   return handleSelectMenu(interaction);
  if (interaction.isChatInputCommand())   return handleCommand(interaction, commands);
});

client.on('messageDelete', message => onMessageDelete(client, message));

client.login(process.env.DISCORD_TOKEN);
