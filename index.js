// index.js — Entry point (Sapphire JS Edition v3)
'use strict';
require('dotenv').config();
const Sentry = require('@sentry/node');

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn:              process.env.SENTRY_DSN,
    environment:      process.env.NODE_ENV ?? 'development',
    tracesSampleRate: 0.2,
  });
}

const { SapphireClient, ApplicationCommandRegistries, RegisterBehavior } = require('@sapphire/framework');
require('@sapphire/plugin-logger/register');
require('@sapphire/plugin-subcommands/register');
const { GatewayIntentBits, Partials } = require('discord.js');
const log = require('./utils/logger.js');

if (!process.env.DISCORD_TOKEN) {
  log.error('SYSTEM', null, 'Thiếu DISCORD_TOKEN trong .env!');
  throw new Error('Thiếu DISCORD_TOKEN trong .env!');
}

ApplicationCommandRegistries.setDefaultBehaviorWhenNotIdentical(
  RegisterBehavior.BulkOverwrite
);

const client = new SapphireClient({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials:                    [Partials.Message, Partials.Channel],
  loadMessageCommandListeners:  false,
  baseUserDirectory:            __dirname,
  logger: { level: process.env.NODE_ENV === 'production' ? 30 : 20 },
});

process.on('unhandledRejection', (reason) => {
  log.error('SYSTEM', null, 'unhandledRejection: %s', reason?.stack ?? reason);
  if (process.env.SENTRY_DSN) Sentry.captureException(reason);
});
process.on('uncaughtException', (err) => {
  log.error('SYSTEM', null, 'uncaughtException: %s', err.stack);
  if (process.env.SENTRY_DSN) Sentry.captureException(err);
});

client.login(process.env.DISCORD_TOKEN);
