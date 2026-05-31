// index.js — Entry point Quản Gia
require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { loadCommands, handleCommand } = require('./handlers/commandHandler.js');
const { handleButton }  = require('./handlers/buttonHandler.js');
const { onReady }       = require('./events/ready.js');
const { onMessageDelete } = require('./events/messageDelete.js');
const { handleSelectMenu } = require('./commands/help.js');
const { handleSetupUi } = require('./handlers/setupUiHandler.js');
const { handleUserPanelButton } = require('./handlers/userPanelHandler.js');
const log = require('./utils/logger.js');

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

client.once('ready', () => onReady(client));

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isButton()) {
      if (interaction.customId?.startsWith('toi:'))   return handleUserPanelButton(interaction);
      if (interaction.customId?.startsWith('setup:')) return handleSetupUi(interaction);
      return handleButton(interaction);
    }

    // ── Setup UI: RoleSelect / ChannelSelect / ModalSubmit ────────────────────────────
    if (
      interaction.isRoleSelectMenu()    ||
      interaction.isChannelSelectMenu() ||
      interaction.isModalSubmit()
    ) {
      if (interaction.customId?.startsWith('setup:')) {
        return handleSetupUi(interaction);
      }
    }

    // ── StringSelectMenu: setup: trước, help sau ──────────────────────────────
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId?.startsWith('setup:')) {
        return handleSetupUi(interaction);
      }
      return handleSelectMenu(interaction);
    }

    if (interaction.isChatInputCommand()) return handleCommand(interaction, commands);
  } catch (err) {
    log.error('SYSTEM', interaction.guildId ?? null, 'interactionCreate lỗi: %s', err.stack ?? err.message);
    const reply = { content: '❌ Có lỗi xảy ra. Vui lòng thử lại.', ephemeral: true };
    if (interaction.deferred || interaction.replied) {
      interaction.editReply(reply).catch(() => {});
    } else {
      interaction.reply(reply).catch(() => {});
    }
  }
});

client.on('messageDelete', message => onMessageDelete(client, message));

client.login(process.env.DISCORD_TOKEN);
