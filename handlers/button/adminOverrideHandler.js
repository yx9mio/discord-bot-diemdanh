// handlers/button/adminOverrideHandler.js — Phase G: Admin override điểm danh
// Admin bấm nút ✏️ Sửa Điểm Danh → modal chọn member + trạng thái
'use strict';
const {
  ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const db  = require('../../db.js');
const log = require('../../utils/logger.js');
const { requireAdmin }  = require('../../utils/permissions.js');
const { replyErrEdit, replyOkEdit, replyErr } = require('../../utils/embeds.js');

const VALID_STATUSES = ['tham_gia', 'tre', 'khong_tham_gia', 'co_phep', 'vang'];
const STATUS_LABEL   = {
  tham_gia:        'Tham Gia',
  tre:             'Đến Trễ',
  khong_tham_gia:  'Vắng',
  co_phep:         'Có Phép',
  vang:            'Vắng (hệ thống)',
};

// Bước 1: Admin bấm nút → mở modal
async function handleAdminOverride(interaction) {
  const { ok } = await requireAdmin(interaction, { context: 'sửa điểm danh' });
  if (!ok) return true;

  const session = await db.getActiveSession(interaction.guild.id);
  if (!session) {
    await interaction.reply(replyErr('📭 Không có phiên nào đang mở.'));
    return true;
  }

  const modal = new ModalBuilder()
    .setCustomId('admin:override_modal')
    .setTitle('✏️ Sửa Điểm Danh');

  const memberInput = new TextInputBuilder()
    .setCustomId('override_user')
    .setLabel('User ID hoặc @mention (ID số)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('123456789012345678')
    .setRequired(true);

  const statusInput = new TextInputBuilder()
    .setCustomId('override_status')
    .setLabel('Trạng thái: tham_gia / tre / khong_tham_gia / co_phep')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('tham_gia')
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(memberInput),
    new ActionRowBuilder().addComponents(statusInput),
  );

  await interaction.showModal(modal);
  return true;
}

// Bước 2: Admin submit modal → upsert attendance
async function handleAdminOverrideModal(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const { ok } = await requireAdmin(interaction, { context: 'sửa điểm danh' });
  if (!ok) return true;

  const session = await db.getActiveSession(interaction.guild.id);
  if (!session) {
    await interaction.editReply(replyErrEdit('📭 Phiên đã đóng.'));
    return true;
  }

  const rawUser = interaction.fields.getTextInputValue('override_user').trim();
  const userId  = rawUser.replace(/^<@!?([\d]+)>$/, '$1').replace(/\D/g, '');
  if (!userId || userId.length < 15) {
    await interaction.editReply(replyErrEdit('❌ User ID không hợp lệ. Nhập ID dạng số hoặc <@ID>.'));
    return true;
  }

  const status = interaction.fields.getTextInputValue('override_status').trim().toLowerCase();
  if (!VALID_STATUSES.includes(status)) {
    await interaction.editReply(replyErrEdit(
      `❌ Trạng thái không hợp lệ.\nCác giá trị hợp lệ: \`${VALID_STATUSES.join('`, `')}\``
    ));
    return true;
  }

  const eligible = session.eligible_member_ids ?? [];
  if (!eligible.includes(userId)) {
    await interaction.editReply(replyErrEdit(
      `❌ <@${userId}> không trong danh sách thành viên của phiên này.`
    ));
    return true;
  }

  const member   = interaction.guild.members.cache.get(userId);
  const username = member?.user?.username ?? userId;

  await db.upsertAttendanceNoTime(
    session.id,
    interaction.guild.id,
    userId,
    username,
    status,
    interaction.user.id,
  );

  log.info('ADMIN_OVERRIDE', interaction.guild.id,
    '%s → set <@%s> = %s (by %s)',
    session.session_name, userId, status, interaction.user.tag ?? interaction.user.id
  );

  const label = STATUS_LABEL[status] ?? status;
  await interaction.editReply(replyOkEdit(
    `✅ Đã sửa: <@${userId}> → **${label}**\n> Phiên: **${session.session_name}**`
  ));
  return true;
}

module.exports = { handleAdminOverride, handleAdminOverrideModal };
