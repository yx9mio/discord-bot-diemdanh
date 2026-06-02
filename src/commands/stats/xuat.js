// src/commands/stats/xuat.js
'use strict';
const { Command } = require('@sapphire/framework');
const { SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const db = require('../../../db.js');
const { replyErr } = require('../../../utils/embeds.js');

class XuatCommand extends Command {
  constructor(context) {
    super(context, { name: 'xuat', description: 'Xuất dữ liệu điểm danh ra file CSV', preconditions: ['AdminOnly'] });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand(
      new SlashCommandBuilder()
        .setName('xuat')
        .setDescription('Xuất dữ liệu điểm danh ra file CSV (Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addStringOption(o => o.setName('loai').setDescription('Loại dữ liệu').setRequired(false)
          .addChoices(
            { name: 'Phiên hiện tại', value: 'current' },
            { name: 'Tất cả phiên',   value: 'all' },
          )
        )
    );
  }

  async chatInputRun(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guild } = interaction;
    const loai = interaction.options.getString('loai') ?? 'current';
    let rows = [], filename = 'diemdanh.csv';

    if (loai === 'current') {
      const session = await db.getActiveSession(guild.id);
      if (!session) return interaction.editReply(replyErr('Không có phiên nào đang mở.'));
      rows     = await db.getAttendances(session.id);
      filename = `phien_${session.id.slice(0, 8)}.csv`;
    } else {
      rows     = await db.getAllAttendances(guild.id);
      filename = `toan_bo_${guild.id}.csv`;
    }

    if (!rows.length) return interaction.editReply(replyErr('Không có dữ liệu.'));

    const header = 'session_id,user_id,status,timestamp\n';
    const csv    = header + rows.map(r => `${r.session_id},${r.user_id},${r.status},${r.created_at}`).join('\n');
    const file   = new AttachmentBuilder(Buffer.from(csv), { name: filename });

    await interaction.editReply({ content: `✅ Xuất ${rows.length} dòng.`, files: [file] });
  }
}

module.exports = { XuatCommand };
