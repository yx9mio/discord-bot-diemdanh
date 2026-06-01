'use strict';
const { Command } = require('@sapphire/framework');

// ── Logic gốc ──────────────────────────────────────────────────────────────
// commands/xuat.js — Phase 7: Admin export CSV
'use strict';
const { SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const db = require('../db.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('xuat')
    .setDescription('Xuất dữ liệu điểm danh ra file CSV (Admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o => o.setName('loai').setDescription('Loại dữ liệu').setRequired(false)
      .addChoices(
        { name: 'Phiên hiện tại', value: 'current' },
        { name: 'Tất cả phiên',   value: 'all' },
      )
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guild } = interaction;
    const loai = interaction.options.getString('loai') ?? 'current';

    let rows = [], filename = 'diemdanh.csv';

    if (loai === 'current') {
      const session = await db.getActiveSession(guild.id);
      if (!session) return interaction.editReply({ content: '⚠️ Không có phiên nào đang mở.' });
      rows = await db.getAttendances(session.id);
      filename = `phien_${session.id.slice(0,8)}.csv`;
    } else {
      rows = await db.getAllAttendances(guild.id);
      filename = `toan_bo_${guild.id}.csv`;
    }

    if (!rows.length) return interaction.editReply({ content: '⚠️ Không có dữ liệu.' });

    const header = 'session_id,user_id,status,timestamp\n';
    const csv    = header + rows.map(r => `${r.session_id},${r.user_id},${r.status},${r.created_at}`).join('\n');
    const file   = new AttachmentBuilder(Buffer.from(csv), { name: filename });

    await interaction.editReply({ content: `✅ Xuất ${rows.length} dòng.`, files: [file] });
  },
};
// ── Sapphire wrapper ──────────────────────────────────────────────────────────
const _origModule = module.exports;
class XuatCommand extends Command {
  constructor(context) { super(context, { name: _origModule.data.name, description: _origModule.data.description, preconditions: ['AdminOnly'] }); }
  registerApplicationCommands(registry) { registry.registerChatInputCommand(_origModule.data); }
  async chatInputRun(interaction) { return _origModule.execute(interaction); }
}
module.exports = { XuatCommand };
