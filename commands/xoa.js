'use strict';
const { Command } = require('@sapphire/framework');

// ── Logic gốc ──────────────────────────────────────────────────────────────
// commands/xoa.js
'use strict';
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../db.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('xoa')
    .setDescription('Xóa điểm danh của một thành viên khỏi phiên hiện tại')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption(o => o.setName('thanh_vien').setDescription('Thành viên cần xóa').setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guild } = interaction;
    const target  = interaction.options.getUser('thanh_vien');
    const session = await db.getActiveSession(guild.id);
    if (!session) return interaction.editReply({ content: '⚠️ Không có phiên nào đang mở.' });

    await db.removeAttendance(session.id, target.id);
    await interaction.editReply({ content: `✅ Đã xóa điểm danh của <@${target.id}> khỏi phiên.` });
  },
};
// ── Sapphire wrapper ──────────────────────────────────────────────────────────
const _origModule = module.exports;
class XoaCommand extends Command {
  constructor(context) { super(context, { name: _origModule.data.name, description: _origModule.data.description, preconditions: ['AdminOnly'] }); }
  registerApplicationCommands(registry) { registry.registerChatInputCommand(_origModule.data); }
  async chatInputRun(interaction) { return _origModule.execute(interaction); }
}
module.exports = { XoaCommand };
