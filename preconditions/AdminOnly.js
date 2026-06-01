'use strict';
const { Precondition } = require('@sapphire/framework');

class AdminOnlyPrecondition extends Precondition {
  chatInputRun(interaction) {
    const member = interaction.member;
    if (!member) return this.error({ message: '❌ Không thể xác định thành viên.' });
    const ok = typeof member.permissions === 'object' && member.permissions.has('ManageGuild');
    if (ok) return this.ok();
    return this.error({ message: '❌ Bạn cần quyền **Quản lý Server** để dùng lệnh này.' });
  }
}
module.exports = { AdminOnlyPrecondition };
