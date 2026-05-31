// commands/sua.js
'use strict';
const { SlashCommandBuilder } = require('discord.js');
const db = require('../db.js');
const { replyOkEdit, replyErrEdit } = require('../utils/embeds.js');
const { requireAdmin } = require('../utils/permissions.js');

const STATUS_LABEL = {
  tham_gia:       '✅ Tham gia',
  tre:            '⏰ Đến trễ',
  khong_tham_gia: '❌ Vắng mặt',
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sua')
    .setDescription('[Admin] Sửa trạng thái điểm danh của một thành viên')
    .setDefaultMemberPermissions(0n)
    .addUserOption(o =>
      o.setName('thanh_vien').setDescription('Thành viên cần sửa').setRequired(true)
    )
    .addStringOption(o =>
      o.setName('trang_thai').setDescription('Trạng thái mới').setRequired(true)
        .addChoices(
          { name: '✅ Tham gia',  value: 'tham_gia' },
          { name: '⏰ Đến trễ',  value: 'tre' },
          { name: '❌ Vắng mặt', value: 'khong_tham_gia' },
        )
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guild } = interaction;

    const { ok } = await requireAdmin(interaction, { context: '/sua' });
    if (!ok) return;

    const session = await db.getActiveSession(guild.id);
    if (!session) {
      return interaction.editReply(replyErrEdit('📭 Không có phiên nào đang mở.'));
    }

    const target      = interaction.options.getUser('thanh_vien');
    const status      = interaction.options.getString('trang_thai');
    const guildMember = await guild.members.fetch(target.id).catch(() => null);
    const displayName = guildMember?.nickname ?? target.globalName ?? target.username;

    await db.upsertAttendanceNoTime(session.id, guild.id, target.id, displayName, status);

    return interaction.editReply(
      replyOkEdit(`Đã cập nhật trạng thái <@${target.id}> thành **${STATUS_LABEL[status] ?? status}**.`)
    );
  },
};
