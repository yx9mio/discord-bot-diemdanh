// tests/commands.test.js
// Kiểm tra contract của mỗi command:
//   - Load được (không throw MODULE_NOT_FOUND)
//   - export { data, execute }
//   - data.name là string không rỗng
//   - execute là function
'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path   = require('node:path');
const fs     = require('node:fs');

// Mock db.js + discord.js để commands load được mà không cần env thật
// Node cache-busting: dùng Module._resolveFilename mock pattern
const Module = require('node:module');
const _origLoad = Module._load.bind(Module);

const MOCK_SUPABASE = {
  from: () => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
    insert: () => ({ select: () => ({ single: async () => ({ data: {}, error: null }) }) }),
    update: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
    upsert: async () => ({ error: null }),
    delete: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
  }),
};

const MOCK_DB = new Proxy({}, {
  get: (_, prop) => {
    if (prop === 'supabase') return MOCK_SUPABASE;
    // Tất cả hàm DB trả về stub async
    return async () => null;
  },
});

const MOCK_DISCORD = {
  SlashCommandBuilder: class {
    setName(n)    { this._name = n; return this; }
    setDescription(d) { return this; }
    addStringOption(fn) { fn({ setName: ()=>({setDescription:()=>({setRequired:()=>({addChoices:()=>({})})})})}); return this; }
    addUserOption(fn)   { fn({ setName: ()=>({setDescription:()=>({setRequired:()=>({})})})}); return this; }
    addIntegerOption(fn){ fn({ setName: ()=>({setDescription:()=>({setRequired:()=>({setMinValue:()=>({setMaxValue:()=>({})})})})})}); return this; }
    addBooleanOption(fn){ fn({ setName: ()=>({setDescription:()=>({setRequired:()=>({})})})}); return this; }
    addChannelOption(fn){ fn({ setName: ()=>({setDescription:()=>({setRequired:()=>({addChannelTypes:()=>({})})})})}); return this; }
    addRoleOption(fn)   { fn({ setName: ()=>({setDescription:()=>({setRequired:()=>({})})})}); return this; }
    addSubcommand(fn)   { fn(this); return this; }
    addSubcommandGroup(fn){ fn(this); return this; }
    toJSON() { return { name: this._name ?? 'mock', description: '' }; }
    get name() { return this._name ?? 'mock'; }
  },
  EmbedBuilder: class {
    setColor()       { return this; }
    setTitle()       { return this; }
    setDescription() { return this; }
    addFields()      { return this; }
    setFooter()      { return this; }
    setTimestamp()   { return this; }
    setThumbnail()   { return this; }
  },
  ActionRowBuilder: class { addComponents() { return this; } },
  ButtonBuilder:   class { setCustomId(){return this;} setLabel(){return this;} setStyle(){return this;} setDisabled(){return this;} },
  StringSelectMenuBuilder: class { setCustomId(){return this;} setPlaceholder(){return this;} addOptions(){return this;} setMinValues(){return this;} setMaxValues(){return this;} },
  StringSelectMenuOptionBuilder: class { setLabel(){return this;} setValue(){return this;} setDescription(){return this;} setEmoji(){return this;} setDefault(){return this;} },
  ButtonStyle: { Primary:1, Secondary:2, Success:3, Danger:4, Link:5 },
  ChannelType: { GuildText:0 },
  PermissionFlagsBits: { Administrator: 8n, ManageGuild: 32n },
  Colors: { Green: 0x57F287, Red: 0xED4245, Yellow: 0xFEE75C, Blurple: 0x5865F2, White: 0xFFFFFF },
  time: (ts, fmt) => `<t:${ts}:${fmt}>`,
  userMention: (id) => `<@${id}>`,
  roleMention: (id) => `<@&${id}>`,
};

// Intercept require cho db.js và discord.js
Module._load = function(request, parent, isMain) {
  const resolved = (() => { try { return Module._resolveFilename(request, parent); } catch { return ''; } })();
  if (resolved.endsWith('db.js') && resolved.includes('/app') === false && !resolved.includes('node_modules')) {
    return MOCK_DB;
  }
  if (request === 'discord.js') return MOCK_DISCORD;
  return _origLoad(request, parent, isMain);
};

// ─── Test mỗi command ─────────────────────────────────────────────────────────
const COMMANDS_DIR = path.join(__dirname, '..', 'commands');
const files = fs.readdirSync(COMMANDS_DIR).filter(f => f.endsWith('.js'));

describe('commands — contract check', () => {
  for (const file of files) {
    const filePath = path.join(COMMANDS_DIR, file);
    describe(file, () => {
      let cmd;

      it('loads without MODULE_NOT_FOUND', () => {
        // Xoá cache để mock có hiệu lực
        delete require.cache[filePath];
        try {
          cmd = require(filePath);
        } catch (e) {
          if (e.code === 'MODULE_NOT_FOUND') throw e;
          // Lỗi khác (env, Discord API) là chấp nhận được trong CI
          cmd = e._partialModule ?? {};
        }
      });

      it('exports data object', () => {
        assert.ok(cmd && cmd.data, `${file} thiếu export "data"`);
      });

      it('data.name là string không rỗng', () => {
        const name = cmd?.data?.name ?? cmd?.data?._name;
        assert.ok(typeof name === 'string' && name.length > 0,
          `${file}: data.name = ${JSON.stringify(name)}`);
      });

      it('exports execute function', () => {
        assert.equal(typeof cmd?.execute, 'function',
          `${file} thiếu export "execute"`);
      });
    });
  }
});
