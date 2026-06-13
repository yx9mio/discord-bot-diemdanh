'use strict';
const { MessageFlags } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const sessionService    = require('../../services/sessionService.js');
const attendanceService = require('../../services/attendanceService.js');
const configService     = require('../../services/configService.js');
const log               = require('../../utils/logger.js');
const { getSessionChannel } = require('../../utils/channel.js');
const { replyErr, buildSessionEmbed, buildAttendanceSelectRow, buildSessionActionRow } = require('../../utils/embeds.js');

class PhaiSelectHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.SelectMenu });
  }

  parse(interaction) {
    if (interaction.customId?.startsWith('phai:select:')) return this.some();
    return this.none();
  }

  async run(interaction) {
    const { guild, user } = interaction;
    const roleId = interaction.values[0];
    const status = interaction.customId.slice('phai:select:'.length);

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const session = await sessionService.getActiveSession(guild.id);
    if (!session) {
      return interaction.editReply({ content: '🚫 Không có phiên điểm danh nào đang mở.' });
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

    // Ghi nhận điểm danh với trạng thái đã chọn từ đầu
    const acquired = attendanceService.tryAcquireAttendanceLock(session.id, user.id);
    if (!acquired) {
      return interaction.editReply({ content: '⏳ Đang xử lý điểm danh của bạn, vui lòng chờ...' });
    }

    try {
      const memberData = await guild.members.fetch(user.id).catch(() => null);
      await attendanceService.upsertAttendance({
        session_id:    session.id,
        user_id:       user.id,
        guild_id:      guild.id,
        status,
        username:      memberData?.nickname ?? user.displayName ?? user.username,
        marked_by:     user.id,
        checked_in_at: new Date().toISOString(),
      });

      const statusLabel = {
        tham_gia:       '✅ Tham gia',
        tre:            '⏰ Trễ',
        co_phep:        '📋 Có phép',
        khong_tham_gia: '❌ Vắng',
      }[status] ?? status;

      // Cập nhật embed phiên
      try {
        const ch = await getSessionChannel(guild, session);
        if (ch && session.message_id) {
          const msg = await ch.messages.fetch(session.message_id).catch(() => null);
          if (msg) {
            const attended = await attendanceService.getAttendances(session.id);
            const phaiIds = session.phai_role_ids?.length
              ? session.phai_role_ids
              : (await configService.getGuildConfig(guild.id).catch(() => null))?.phai_role_ids ?? [];
            const { embed, components: pagComponents } = buildSessionEmbed(
              guild, session, attended, phaiIds
            );
            const selectRow = buildAttendanceSelectRow(true);
            const adminRows = buildSessionActionRow(true);
            await msg.edit({
              embeds: [embed],
              components: [selectRow, ...adminRows, ...pagComponents].slice(0, 5),
            }).catch(() => null);
          }
        }
      } catch (e) {
        log.error('PHAI_SELECT', guild.id, 'Update embed fail: %s', e.message);
      }

      log.info('PHAI_SELECT', guild.id, '%s điểm danh: %s (phái %s)', user.tag, status, roleId);
      return interaction.editReply({
        content: `✅ Đã thêm phái <@&${roleId}>. ${statusLabel} — Đã ghi nhận điểm danh của bạn.`,
      });
    } catch (e) {
      log.error('PHAI_SELECT', guild.id, 'Lỗi upsertAttendance: %s', e.message);
      return interaction.editReply(replyErr('❌ Không thể ghi nhận điểm danh, thử lại sau.'));
    } finally {
      attendanceService.releaseAttendanceLock(session.id, user.id);
    }
  }
}

module.exports = { PhaiSelectHandler };
