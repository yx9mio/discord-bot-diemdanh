// interaction-handlers/adminEditModal.js
// Modal cho admin sửa điểm danh của member — upsert + update embed
'use strict';
const { MessageFlags } = require('discord.js');
const {
  InteractionHandler, InteractionHandlerTypes,
} = require('@sapphire/framework');
const { getActiveSession } = require('../../services/sessionService.js');
const { getAttendances, upsertAttendance } = require('../../services/attendanceService.js');
const configService = require('../../services/configService.js');
const log = require('../../utils/logger.js');
const { requireAdmin } = require('../../utils/permissions.js');
const { addBreadcrumb } = require('../../utils/sentry.js');
const { getSessionChannel } = require('../../utils/channel.js');
const { buildSessionEmbed, buildAttendanceSelectRow, buildSessionActionRow } = require('../../utils/embeds.js');

const STATUS_LABELS = {
  tham_gia:       '✅ Tham gia',
  tre:            '⏰ Trễ',
  khong_tham_gia: '❌ Vắng',
  co_phep:        '📋 Có phép',
};

class AdminEditModalHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.ModalSubmit });
  }

  parse(interaction) {
    if (interaction.customId === 'admin:edit:modal') return this.some();
    return this.none();
  }

  async run(interaction) {
    addBreadcrumb('interaction', 'adminEditModal', {
      customId: interaction.customId,
      userId: interaction.user?.id,
    });
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const { guild, user } = interaction;
    const { ok } = await requireAdmin(interaction, { context: 'sửa điểm danh', deferred: true });
    if (!ok) return;

    const session = await getActiveSession(guild.id);
    if (!session) {
      return interaction.editReply({ content: '🚫 Không có phiên điểm danh nào đang mở.' });
    }
    if (session.guild_id !== guild.id) {
      log.warn('ADMIN_EDIT', guild.id, 'SECURITY: guild mismatch user=%s', user.id);
      return interaction.editReply({ content: '❌ Phiên không hợp lệ.' });
    }

    const userField = interaction.fields.getTextInputValue('user_id').trim();
    const statusField = interaction.fields.getTextInputValue('status').trim().toLowerCase();

    const STATUS_ALIASES = {
      'tham_gia': 'tham_gia', 'tham gia': 'tham_gia', 'có mặt': 'tham_gia', 'comat': 'tham_gia', 'co mat': 'tham_gia',
      'tre': 'tre', 'trễ': 'tre', 'muộn': 'tre', 'muon': 'tre',
      'khong_tham_gia': 'khong_tham_gia', 'không tham gia': 'khong_tham_gia', 'vắng': 'khong_tham_gia', 'vang': 'khong_tham_gia', 'absent': 'khong_tham_gia',
      'co_phep': 'co_phep', 'có phép': 'co_phep', 'co phep': 'co_phep',
    };
    const resolvedStatus = STATUS_ALIASES[statusField];
    if (!resolvedStatus) {
      return interaction.editReply({
        content: `❌ Trạng thái không hợp lệ. Gợi ý: \`tham_gia\`, \`tre\`, \`khong_tham_gia\`, \`co_phep\` (hoặc tiếng Việt: \`vắng\`, \`trễ\`, \`có phép\`)`,
      });
    }

    if (userField.startsWith('<@&')) {
      return interaction.editReply({ content: '❌ Vui lòng mention user (không phải role), hoặc nhập thẳng User ID.' });
    }

    let targetUserId;
    if (userField.startsWith('<@') && userField.endsWith('>')) {
      targetUserId = userField.slice(2, -1).replace('!', '');
    } else {
      targetUserId = userField;
    }

    let targetMember;
    try {
      targetMember = await guild.members.fetch(targetUserId);
    } catch {
      return interaction.editReply({ content: `❌ Không tìm thấy user với ID: ${targetUserId}` });
    }

    if (targetMember.user.bot) {
      return interaction.editReply({ content: '❌ Không thể sửa điểm danh cho bot.' });
    }

    const username = targetMember.nickname ?? targetMember.user.displayName ?? targetMember.user.username;

    try {
      await upsertAttendance({
        session_id:    session.id,
        guild_id:      guild.id,
        user_id:       targetUserId,
        username,
        status:        resolvedStatus,
        marked_by:     user.id,
      });
    } catch (e) {
      log.error('ADMIN_EDIT', guild.id, 'upsertAttendance thất bại: %s', e.message);
      return interaction.editReply({ content: '❌ Không thể lưu điểm danh, thử lại sau.' });
    }

    log.info('ADMIN_EDIT', guild.id, '%s sửa điểm danh %s → %s', user.tag, targetUserId, statusField);

    try {
      const ch = await getSessionChannel(guild, session);
      if (ch && session.message_id) {
        const msg = await ch.messages.fetch(session.message_id).catch(() => null);
        if (msg) {
          const attended = await getAttendances(session.id);
          const cfgA2 = await configService.getGuildConfig(guild.id).catch(() => null);
          const phaiIds = session.phai_role_ids?.length
            ? session.phai_role_ids
            : cfgA2?.phai_role_ids ?? [];
          const { embed, components: pagComponents } = buildSessionEmbed(
            guild, session, attended, phaiIds, false, 1, cfgA2?.phai_role_icons ?? null
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
      log.error('ADMIN_EDIT', guild.id, 'Lỗi update embed: %s', e.message);
    }

    return interaction.editReply({
      content: `✅ Đã sửa điểm danh của **${username}** → ${STATUS_LABELS[resolvedStatus]}`,
    });
  }
}

module.exports = { AdminEditModalHandler };
