// index.js — Entry point (Sapphire JS Edition v3)
// [DATADOG] dd-trace PHẢI là require đầu tiên — trước mọi import khác
'use strict';
if (process.env.DD_API_KEY) {
  try {
    require('dd-trace').init({
      service:     process.env.DD_SERVICE ?? 'discord-bot-diemdanh',
      env:         process.env.DD_ENV     ?? process.env.NODE_ENV ?? 'production',
      version:     process.env.npm_package_version,
      hostname:    'intake.logs.' + (process.env.DD_SITE ?? 'ap1.datadoghq.com'),
      logInjection: true,
      runtimeMetrics: true,
      profiling:   false,
    });
  } catch (e) {
    console.error('[BOOT] dd-trace init failed (module missing?):', e.message);
  }
}

require('dotenv').config();
const path = require('node:path');
const Sentry = require('@sentry/node');

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn:              process.env.SENTRY_DSN,
    environment:      process.env.NODE_ENV ?? 'development',
    tracesSampleRate:  0.2,
  });
}

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

ApplicationCommandRegistries.setDefaultBehaviorWhenNotIdentical(
  RegisterBehavior.BulkOverwrite
);
if (process.env.GUILD_ID) {
  ApplicationCommandRegistries.setDefaultGuildIds([process.env.GUILD_ID]);
}

const client = new SapphireClient({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials:                    [Partials.Message, Partials.Channel],
  loadMessageCommandListeners:  false,
  baseUserDirectory:            null,
  logger: { level: process.env.NODE_ENV === 'production' ? 30 : 20 },
});

client.stores.get('commands').registerPath(path.join(__dirname, 'src', 'commands'));
client.stores.get('listeners').registerPath(path.join(__dirname, 'listeners'));
client.stores.get('interaction-handlers').registerPath(path.join(__dirname, 'interaction-handlers'));
// [FIX] Sapphire v3 không scan đệ quy — phải đăng ký sub-folder riêng
client.stores.get('interaction-handlers').registerPath(path.join(__dirname, 'interaction-handlers', 'setup'));
client.stores.get('preconditions').registerPath(path.join(__dirname, 'preconditions'));

// Health server cho Railway keepalive — phải start trước client.login()
startHealthServer(client);

// [DEBUG] Log số handlers được load sau khi client ready
client.once('ready', () => {
  const handlerStore = client.stores.get('interaction-handlers');
  console.log(`[BOOT] interaction-handlers loaded: ${handlerStore.size}`);
  for (const [name] of handlerStore) {
    console.log(`  - ${name}`);
  }
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
