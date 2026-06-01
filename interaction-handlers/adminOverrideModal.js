// interaction-handlers/adminOverrideModal.js
// Handles: admin:override_modal submit (Sapphire ModalSubmit handler)
// BUG-7 fix: requireAdmin sau deferReply, không trước
// BUG-10 fix: đây là handler duy nhất cho modal này (không còn duplicate)
'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const db  = require('../db.js');
const log = require('../utils/logger.js');
const { requireAdmin }  = require('../utils/permissions.js');
const { replyErrEdit, replyOkEdit } = require('../utils/embeds.js');

const VALID_STATUSES = ['tham_gia', 'tre', 'khong_tham_gia', 'co_phep', 'vang'];
const STATUS_LABEL   = {
  tham_gia:       'Tham Gia',
  tre:            'Đến Trễ',
  khong_tham_gia: 'Vắng',
  co_phep:        'Có Phép',
  vang:           'Vắng (hệ thống)',
};

class AdminOverrideModalHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.ModalSubmit });
  }

  parse(interaction) {
    if (interaction.customId === 'admin:override_modal') return this.some();
    return this.none();
  }

  async run(interaction) {
    // BUG-7 fix: deferReply TRƯỚC khi gọi requireAdmin
    // (requireAdmin gọi interaction.reply bên trong nếu fail → crash nếu đã defer)
    // Giải pháp: defer trước, requireAdmin phải dùng editReply thay reply
    await interaction.deferReply({ ephemeral: true });

    const { ok } = await requireAdmin(interaction, { context: 'sửa điểm danh', deferred: true });
    if (!ok) return;

    const session = await db.getActiveSession(interaction.guild.id);
    if (!session) return interaction.editReply(replyErrEdit('📭 Phiên đã đóng.'));

    const rawUser = interaction.fields.getTextInputValue('override_user').trim();
    const userId  = rawUser.replace(/^<@!?([\d]+)>$/, '$1').replace(/\D/g, '');
    if (!userId || userId.length < 15) {
      return interaction.editReply(replyErrEdit('❌ User ID không hợp lệ. Nhập ID dạng số hoặc <@ID>.'));
    }

    const status = interaction.fields.getTextInputValue('override_status').trim().toLowerCase();
    if (!VALID_STATUSES.includes(status)) {
      return interaction.editReply(replyErrEdit(
        `❌ Trạng thái không hợp lệ.\nCác giá trị hợp lệ: \`${VALID_STATUSES.join('`, `')}\``
      ));
    }

    const eligible = session.eligible_member_ids ?? [];
    if (eligible.length && !eligible.includes(userId)) {
      return interaction.editReply(replyErrEdit(
        `❌ <@${userId}> không trong danh sách thành viên của phiên này.`
      ));
    }

    const member   = interaction.guild.members.cache.get(userId);
    const username = member?.user?.username ?? userId;

    await db.upsertAttendanceNoTime(
      session.id, interaction.guild.id, userId, username, status, interaction.user.id,
    );

    log.info('ADMIN_OVERRIDE', interaction.guild.id,
      '%s → set <@%s> = %s (by %s)',
      session.session_name, userId, status, interaction.user.tag ?? interaction.user.id
    );

    const label = STATUS_LABEL[status] ?? status;
    return interaction.editReply(replyOkEdit(
      `✅ Đã sửa: <@${userId}> → **${label}**\n> Phiên: **${session.session_name}**`
    ));
  }
}

module.exports = { AdminOverrideModalHandler };
