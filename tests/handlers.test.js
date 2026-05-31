// tests/handlers.test.js
// Kiểm tra commandHandler load + handleCommand dispatch
'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path   = require('node:path');
const Module = require('node:module');

// Reuse discord.js mock từ commands.test đã register
// (Module._load đã bị patch ở commands.test nên nếu chạy riêng cần re-patch)
// Để test độc lập, patch lại ở đây:
const _origLoad2 = Module._load.bind(Module);
const MOCK_DISCORD2 = {
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
};
const MOCK_DB2 = new Proxy({}, { get: (_,p) => p==='supabase'?{}:async()=>null });

Module._load = function(request, parent, isMain) {
  if (request === 'discord.js') return MOCK_DISCORD2;
  const resolved = (() => { try { return Module._resolveFilename(request, parent); } catch { return ''; } })();
  if (resolved.endsWith('/db.js') && !resolved.includes('node_modules')) return MOCK_DB2;
  return _origLoad2(request, parent, isMain);
};

describe('commandHandler.js', () => {
  let loadCommands, handleCommand;

  it('loads without error', () => {
    // Xoá cache để mock có hiệu lực
    const hPath = path.join(__dirname, '..', 'handlers', 'commandHandler.js');
    delete require.cache[hPath];
    ({ loadCommands, handleCommand } = require('../handlers/commandHandler.js'));
  });

  it('exports loadCommands function', () => {
    assert.equal(typeof loadCommands, 'function');
  });

  it('exports handleCommand function', () => {
    assert.equal(typeof handleCommand, 'function');
  });

  it('loadCommands() trả về Map', () => {
    const commands = loadCommands();
    assert.ok(commands instanceof Map, 'loadCommands phải trả về Map');
    assert.ok(commands.size > 0, `Map rỗng — không load được command nào`);
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
    await assert.doesNotReject(() => handleCommand(fakeInteraction, commands));
  });
});
