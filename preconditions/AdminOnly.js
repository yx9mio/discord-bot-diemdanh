// preconditions/AdminOnly.js — Thay thế requireAdmin() thủ công
'use strict';
const { Precondition } = require('@sapphire/framework');

class AdminOnlyPrecondition extends Precondition {
  async chatInputRun(interaction) {
    const member = interaction.member;
    if (!member) return this.error({ message: '❌ Không thể xác định thành viên.' });

    const hasPermission =
      typeof member.permissions === 'object'
        ? member.permissions.has('ManageGuild')
        : false;

    if (hasPermission) return this.ok();

    return this.error({
      message: '❌ Bạn cần quyền **Quản lý Server** để dùng lệnh này.',
    });
  }
}

module.exports = { AdminOnlyPrecondition };
