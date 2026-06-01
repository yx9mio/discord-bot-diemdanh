'use strict';
const { Command } = require('@sapphire/framework');

// ── Logic gốc ──────────────────────────────────────────────────────────────
// commands/sua.js
'use strict';
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../db.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sua')
    .setDescription('Sửa trạng thái điểm danh của một thành viên')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption(o => o.setName('thanh_vien').setDescription('Thành viên cần sửa').setRequired(true))
    .addStringOption(o => o.setName('trang_thai').setDescription('Trạng thái mới').setRequired(true)
      .addChoices(
        { name: '✅ Tham gia', value: 'tham_gia' },
        { name: '⏰ Đến trễ',  value: 'tre' },
        { name: '❌ Vắng',     value: 'khong_tham_gia' },
        { name: '🟡 Có phép',  value: 'co_phep' },
      )
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guild } = interaction;
    const target = interaction.options.getUser('thanh_vien');
    const status = interaction.options.getString('trang_thai');

    const session = await db.getActiveSession(guild.id);
    if (!session) return interaction.editReply({ content: '⚠️ Không có phiên nào đang mở.' });

    await db.upsertAttendance({ session_id: session.id, user_id: target.id, status, updated_by: interaction.user.id });
    const label = { tham_gia: '✅ Tham gia', tre: '⏰ Trễ', khong_tham_gia: '❌ Vắng', co_phep: '🟡 Có phép' };
    await interaction.editReply({ content: `✅ Đã cập nhật <@${target.id}>: **${label[status]}**` });
  },
};
// ── Sapphire wrapper ──────────────────────────────────────────────────────────
const _origModule = module.exports;
class SuaCommand extends Command {
  constructor(context) { super(context, { name: _origModule.data.name, description: _origModule.data.description, preconditions: ['AdminOnly'] }); }
  registerApplicationCommands(registry) { registry.registerChatInputCommand(_origModule.data); }
  async chatInputRun(interaction) { return _origModule.execute(interaction); }
}
module.exports = { SuaCommand };
