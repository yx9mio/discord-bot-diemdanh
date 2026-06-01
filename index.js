// index.js — Entry point
require('dotenv').config();
const Sentry = require('@sentry/node');

// P5: Sentry khởi tạo sớm nhất — trước mọi require khác
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn:              process.env.SENTRY_DSN,
    environment:      process.env.NODE_ENV ?? 'development',
    tracesSampleRate: 0.2,
  });
}

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

client.once('clientReady',     ()      => onReady(client));
client.on('guildCreate',       guild   => onGuildCreate(guild));
client.on('messageDelete',     message => onMessageDelete(client, message));
client.on('interactionCreate', i       => onInteractionCreate(i, commands));

// P5: bắt unhandledRejection + uncaughtException gửi Sentry
process.on('unhandledRejection', (reason) => {
  log.error('SYSTEM', null, 'unhandledRejection: %s', reason?.stack ?? reason);
  if (process.env.SENTRY_DSN) Sentry.captureException(reason);
});
process.on('uncaughtException', (err) => {
  log.error('SYSTEM', null, 'uncaughtException: %s', err.stack);
  if (process.env.SENTRY_DSN) Sentry.captureException(err);
});

client.login(process.env.DISCORD_TOKEN);
