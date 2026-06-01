'use strict';
const { Command } = require('@sapphire/framework');

// ── Logic gốc ──────────────────────────────────────────────────────────────
// commands/log.js — xem log bot từ ring buffer in-memory
'use strict';
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, codeBlock } = require('discord.js');

let _logBuffer = [];
const MAX_LOG = 200;

function pushLog(level, msg) {
  _logBuffer.push({ ts: new Date().toISOString(), level, msg });
  if (_logBuffer.length > MAX_LOG) _logBuffer.shift();
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('log')
    .setDescription('Xem log bot gần nhất (Admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addIntegerOption(o => o.setName('so_dong').setDescription('Số dòng hiển thị (mặc định 20)').setRequired(false).setMinValue(1).setMaxValue(50))
    .addStringOption(o => o.setName('level').setDescription('Lọc theo level').setRequired(false)
      .addChoices(
        { name: 'ALL',   value: 'all' },
        { name: 'ERROR', value: 'error' },
        { name: 'WARN',  value: 'warn' },
        { name: 'INFO',  value: 'info' },
      )
    ),

  pushLog,

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const n     = interaction.options.getInteger('so_dong') ?? 20;
    const level = interaction.options.getString('level') ?? 'all';

    let logs = _logBuffer.slice(-n);
    if (level !== 'all') logs = logs.filter(l => l.level === level);

    if (!logs.length)
      return interaction.editReply({ content: '📭 Không có log nào.' });

    const lines = logs.map(l => `[${l.level.toUpperCase()}] ${l.ts.slice(11,19)} ${l.msg}`).join('\n');
    const embed = new EmbedBuilder()
      .setColor(0x006494)
      .setTitle(`📜 Log Bot (${logs.length} dòng)`)
      .setDescription(codeBlock('yaml', lines.slice(0, 3900)))
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
// ── Sapphire wrapper ──────────────────────────────────────────────────────────
const _origModule = module.exports;
class LogCommand extends Command {
  constructor(context) { super(context, { name: _origModule.data.name, description: _origModule.data.description, preconditions: ['AdminOnly'] }); }
  registerApplicationCommands(registry) { registry.registerChatInputCommand(_origModule.data); }
  async chatInputRun(interaction) { return _origModule.execute(interaction); }
}
module.exports = { LogCommand };
