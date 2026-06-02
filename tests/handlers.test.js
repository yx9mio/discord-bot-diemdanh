// tests/handlers.test.js
// Kiểm tra commandHandler load + handleCommand dispatch
'use strict';
import { describe, it, expect, beforeAll } from 'vitest';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const Module = require('node:module');

// Patch Module._load để mock discord.js, @sapphire/framework, và db.js
const MOCK_DISCORD = {
  SlashCommandBuilder: class {
    setName(n)    { this._name = n; return this; }
    setDescription() { return this; }
    toJSON() { return { name: this._name ?? 'mock' }; }
    get name() { return this._name ?? 'mock'; }
  },
  EmbedBuilder: class { setColor(){return this;} setTitle(){return this;} setDescription(){return this;} addFields(){return this;} setFooter(){return this;} setTimestamp(){return this;} },
  ButtonStyle: {}, ChannelType: {}, PermissionFlagsBits: {}, Colors: {}, ActionRowBuilder: class{addComponents(){return this;}},
  ButtonBuilder: class{setCustomId(){return this;}setLabel(){return this;}setStyle(){return this;}setDisabled(){return this;}},
  StringSelectMenuBuilder: class{setCustomId(){return this;}setPlaceholder(){return this;}addOptions(){return this;}},
  StringSelectMenuOptionBuilder: class{setLabel(){return this;}setValue(){return this;}setDescription(){return this;}setEmoji(){return this;}setDefault(){return this;}},
  time: (ts,f)=>`<t:${ts}:${f}>`, userMention: id=>`<@${id}>`, roleMention: id=>`<@&${id}>`,
  MessageFlags: { Ephemeral: 64 },
};
// @sapphire/framework — các command file dùng `const { Command } = require('@sapphire/framework')`
// Cung cấp class Command rỗng + các helper khác để require() không throw
const MOCK_SAPPHIRE = {
  Command: class { constructor() {} },
  container: { client: null, logger: { info: () => {}, warn: () => {}, error: () => {} } },
  Piece: class {},
  Listener: class {},
};
const MOCK_DB = new Proxy({}, { get: (_,p) => p==='supabase'?{}:async()=>null });

const _origLoad = Module._load.bind(Module);
Module._load = function(request, parent, isMain) {
  if (request === 'discord.js') return MOCK_DISCORD;
  if (request === '@sapphire/framework') return MOCK_SAPPHIRE;
  const resolved = (() => { try { return Module._resolveFilename(request, parent); } catch { return ''; } })();
  if (resolved.endsWith('/db.js') && !resolved.includes('node_modules')) return MOCK_DB;
  return _origLoad(request, parent, isMain);
};

describe('commandHandler.js', () => {
  let loadCommands, handleCommand;

  beforeAll(() => {
    // Xoá cache để mock có hiệu lực
    const hPath = path.join(__dirname, '..', 'handlers', 'commandHandler.js');
    delete require.cache[hPath];
    ({ loadCommands, handleCommand } = require('../handlers/commandHandler.js'));
  });

  it('loads without error', () => {
    expect(loadCommands).toBeDefined();
    expect(handleCommand).toBeDefined();
  });

  it('exports loadCommands function', () => {
    expect(typeof loadCommands).toBe('function');
  });

  it('exports handleCommand function', () => {
    expect(typeof handleCommand).toBe('function');
  });

  it('loadCommands() trả về Map', () => {
    const commands = loadCommands();
    expect(commands).toBeInstanceOf(Map);
    expect(commands.size).toBeGreaterThan(0);
  });

  it('handleCommand bỏ qua command không tồn tại (không throw)', async () => {
    const commands = loadCommands();
    const fakeInteraction = {
      commandName: '__nonexistent__',
      deferred: false,
      replied: false,
      guildId: 'test-guild',
      reply: async () => {},
    };
    await expect(() => handleCommand(fakeInteraction, commands)).not.toThrow();
  });
});
