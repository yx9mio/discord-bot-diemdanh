'use strict';
require('dotenv').config();
const path = require('node:path');
const { SapphireClient, ApplicationCommandRegistries, RegisterBehavior } = require('@sapphire/framework');
require('@sapphire/plugin-logger/register');
require('@sapphire/plugin-subcommands/register');
const { GatewayIntentBits, Partials } = require('discord.js');
const log = require('./utils/logger.js');
const { startHealthServer } = require('./events/healthServer.js');

if (!process.env.DISCORD_TOKEN) {
  log.error('SYSTEM', null, 'Thiếu DISCORD_TOKEN trong .env!');
  throw new Error('Thiếu DISCORD_TOKEN trong .env!');
}

ApplicationCommandRegistries.setDefaultBehaviorWhenNotIdentical(RegisterBehavior.BulkOverwrite);

const client = new SapphireClient({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials:                   [Partials.Message, Partials.Channel],
  loadMessageCommandListeners: false,
  baseUserDirectory:           null,
  logger: { level: process.env.NODE_ENV === 'production' ? 30 : 20 },
});

client.stores.get('commands')            .registerPath(path.join(__dirname, 'src', 'commands'));
client.stores.get('listeners')           .registerPath(path.join(__dirname, 'src', 'listeners'));
client.stores.get('interaction-handlers').registerPath(path.join(__dirname, 'src', 'interaction-handlers'));
client.stores.get('preconditions')       .registerPath(path.join(__dirname, 'src', 'preconditions'));

startHealthServer(client);

client.once('ready', () => {
  const handlerStore = client.stores.get('interaction-handlers');
  log.info('BOOT', null, 'interaction-handlers loaded: %d', handlerStore.size);
  for (const [name] of handlerStore) log.info('BOOT', null, '  handler: %s', name);

  const commandStore = client.stores.get('commands');
  log.info('BOOT', null, 'commands loaded: %d', commandStore.size);
  for (const [name] of commandStore) log.info('BOOT', null, '  command: /%s', name);
});

process.on('unhandledRejection', (reason) => {
  log.error('SYSTEM', null, 'unhandledRejection: %s', reason?.stack ?? reason);
});
process.on('uncaughtException', (err) => {
  log.error('SYSTEM', null, 'uncaughtException: %s', err.stack);
});

client.login(process.env.DISCORD_TOKEN);
