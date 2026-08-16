'use strict';
const { MessageFlags } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const { requireAdmin } = require('../../../utils/permissions.js');
const { replyErrEdit } = require('../../../utils/embeds.js');
const log = require('../../../utils/logger.js');
const { wrapHandler } = require('../../../utils/error-boundary.js');
const { checkCooldown } = require('../../../utils/cooldown.js');
const wizardDraft = require('../../../utils/wizardDraft.js');
const { renderStep2 } = require('../../../utils/_views/wizardView.js');

const MODAL_ID = 'setup:session:start:modal';

class SetupSessionStartModalHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.ModalSubmit });
  }

  parse(interaction) {
    if (interaction.customId === MODAL_ID) return this.some();
    return this.none();
  }

  async run(interaction) {
    return wrapHandler(async (interaction) => {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const { ok } = await requireAdmin(interaction, { context: 'mở phiên', deferred: true });
    if (!ok) return;
    if (!checkCooldown(interaction.user.id, 'setup_session_start_modal', 5000)) {
      return interaction.editReply({ content: '⏳ Vui lòng đợi một chút trước khi thực hiện hành động này.' });
    }
    const { guild } = interaction;

    try {
      const tenRaw   = interaction.fields.getTextInputValue('ten_phien')?.trim() || '';
      const phutDong = interaction.fields.getTextInputValue('phut_dong')?.trim();
      const moTa     = interaction.fields.getTextInputValue('mo_ta')?.trim() || '';
      const ten = tenRaw || `Bang Chiến ${new Date().toLocaleDateString('vi-VN')}`;

      let phut = null;
      if (phutDong) {
        const n = parseInt(phutDong, 10);
        if (isNaN(n) || n < 1 || n > 1440) return interaction.editReply(replyErrEdit('Số phút không hợp lệ (1–1440).'));
        phut = n;
      }

      // [UX-W3] B1 (modal) → lưu draft, hiển thị B2: chọn kênh + role
      wizardDraft.put(interaction.user.id, { ten, phut, moTa, channelId: null, roleId: null });
      await guild.channels.fetch().catch(() => {});
      await guild.roles.fetch().catch(() => {});

      const draft = wizardDraft.get(interaction.user.id);
      return interaction.editReply(renderStep2({ guild, draft }));
    } catch (e) {
      log.error('SESSION_START_MODAL', guild.id, 'Lỗi khởi tạo wizard: %s', e.message);
      return interaction.editReply(replyErrEdit(`Không thể khởi tạo: ${e.message}`));
    }
  }, 'SetupSessionStartModalHandler')(interaction); }
}

module.exports = { SetupSessionStartModalHandler, MODAL_ID };