// commands/them.js
'use strict';
const { SlashCommandBuilder } = require('discord.js');
const db = require('../db.js');
const { buildSessionEmbed, buildAttendanceButtons, replyOkEdit, replyErrEdit } = require('../utils/embeds.js');
const { laAdmin } = require('../utils/helpers.js');

const LABEL_MAP = {
  tham_gia:        '✅ Tham Gia',
  tre:             '⏰ Đến Trễ',
  khong_tham_gia:  '❌ Vắng Mặt',
};

const data = new SlashCommandBuilder()
  .setName('them_diemdanh')
  .setDescription('Thêm thành viên vào điểm danh thủ công')
  .addUserOption(o =>
    o.setName('thanh_vien').setDescription('Thành viên cần thêm').setRequired(true)
  )
  .addStringOption(o =>
    o.setName('trang_thai')
      .setDescription('Trạng thái (mặc định: Tham Gia)')
      .addChoices(
        { name: '✅ Tham Gia',  value: 'tham_gia' },
        { name: '⏰ Đến Trễ',   value: 'tre' },
        { name: '❌ Vắng Mặt', value: 'khong_tham_gia' },
      )
  );

async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const guild = interaction.guild;

  const cfg = await db.getConfig(guild.id);
  if (!laAdmin(interaction.member, cfg)) {
    return interaction.editReply(replyErrEdit('🔒 Bạn không có quyền thực hiện lệnh này.'));
  }

  const session = await db.getActiveSession(guild.id);
  if (!session) {
    return interaction.editReply(replyErrEdit('📭 Không có phiên điểm danh nào đang mở.'));
  }

  const target      = interaction.options.getUser('thanh_vien');
  const status      = interaction.options.getString('trang_thai') ?? 'tham_gia';
  const gMember     = await guild.members.fetch(target.id).catch(() => null);
  const displayName = gMember?.displayName ?? target.username;

  try {
    await db.upsertAttendance(session.id, guild.id, target.id, displayName, status);
  } catch (err) {
    console.error('[them_diemdanh] Lỗi upsertAttendance:', err);
    return interaction.editReply(replyErrEdit('Có lỗi khi ghi điểm danh. Vui lòng thử lại.'));
  }

  // Cập nhật embed gốc
  try {
    if (session.message_id) {
      const channel = interaction.channel;
      const msg = await channel.messages.fetch(session.message_id).catch(() => null);
      if (msg) {
        const attended = await db.getAttendances(session.id);
        const embed = await buildSessionEmbed(guild, session, attended);
        await msg.edit({ embeds: [embed], components: [buildAttendanceButtons(false)] });
      }
    }
  } catch (_) {}

  return interaction.editReply(
    replyOkEdit(`Đã ghi nhận **${displayName}** — ${LABEL_MAP[status] ?? status} vào phiên **${session.session_name}**.`)
  );
}

module.exports = { data, execute };
