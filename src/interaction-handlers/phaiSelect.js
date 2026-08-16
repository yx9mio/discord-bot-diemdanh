'use strict';
const { MessageFlags } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const sessionService    = require('../../services/sessionService.js');
const log               = require('../../utils/logger.js');
const { buildAttendanceConfirmPrompt, buildAttendanceConfirmRow } = require('../../utils/embeds.js');
const { checkCooldown } = require('../../utils/cooldown.js');
const { wrapHandler } = require('../../utils/error-boundary.js');

class PhaiSelectHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.SelectMenu });
  }

  parse(interaction) {
    if (interaction.customId?.startsWith('phai:select:')) return this.some();
    return this.none();
  }

  async run(interaction) {
    return wrapHandler(async (interaction) => {
    const { guild, user } = interaction;
    const roleId = interaction.values[0];
    const status = interaction.customId.slice('phai:select:'.length);

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const session = await sessionService.getActiveSession(guild.id);
    if (!session) {
      return interaction.editReply({ content: '🚫 Không có Kỳ điểm danh nào đang mở.' });
    }

    // Assign role phái cho user
    try {
      const member = await guild.members.fetch(user.id);
      const role = guild.roles.cache.get(roleId);
      if (!role) {
        return interaction.editReply({ content: '❌ Role phái không tồn tại hoặc đã bị xoá.' });
      }
      await member.roles.add(roleId);
      log.info('PHAI_SELECT', guild.id, 'Assigned role %s (%s) to %s', role.name, roleId, user.tag);
    } catch (e) {
      log.error('PHAI_SELECT', guild.id, 'Role assignment failed for %s: %s', user.tag, e.message);
      return interaction.editReply({ content: '❌ Không thể gán role phái. Bot cần quyền **Quản lý role**. Vui lòng báo admin.' });
    }

    // Rate limit
    if (!checkCooldown(user.id, 'attendance', 2000)) {
      return interaction.editReply({ content: '⏳ Bạn đang thao tác quá nhanh, vui lòng chậm lại...' });
    }

    // [UX-P2] Sau khi gán phái → nhảy vào xác nhận riêng (chưa ghi DB)
    log.info('PHAI_SELECT', guild.id, '%s chọn phái %s, chờ xác nhận: %s', user.tag, roleId, status);
    return interaction.editReply({
      ...buildAttendanceConfirmPrompt(status, session.session_name),
      components: [buildAttendanceConfirmRow(session.id, status)],
    });
  }, 'PhaiSelectHandler')(interaction); }
}

module.exports = { PhaiSelectHandler };