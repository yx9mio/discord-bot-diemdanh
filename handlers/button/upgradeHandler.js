// handlers/button/upgradeHandler.js — Phase N: Ephemeral confirm nâng cấp
'use strict';
const { requireAdmin } = require('../../utils/permissions.js');
const { _replyErrEdit } = require('../../utils/embeds.js');

/**
 * Hiển thị ephemeral confirm khi admin bấm nút upgrade:confirm.
 * Thay vì thực hiện ngay → yêu cầu xác nhận 1 bước để tránh nhầm.
 */
async function handleUpgradeConfirm(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const { ok } = await requireAdmin(interaction, { context: 'nâng cấp cấu hình' });
  if (!ok) return true;
  await interaction.editReply({
    content: [
      '⚙️ **Xác nhận nâng cấp cấu hình?**',
      '> Hành động này sẽ áp dụng thay đổi. Bấm lại lệnh `/setup` để tiếp tục hoặc bỏ qua nếu nhầm.',
    ].join('\n'),
    ephemeral: true,
  });
  return true;
}

module.exports = { handleUpgradeConfirm };
