// interaction-handlers/adminEditModal.js
// Modal cho admin sửa điểm danh của member — upsert + update embed
'use strict';
const { MessageFlags, EmbedBuilder } = require('discord.js');
const {
  InteractionHandler, InteractionHandlerTypes,
} = require('@sapphire/framework');
const { getActiveSession } = require('../../services/sessionService.js');
const { upsertAttendance } = require('../../services/attendanceService.js');
const log = require('../../utils/logger.js');
const { requireAdmin } = require('../../utils/permissions.js');
const { auditLog } = require('../../utils/auditLog.js');
const { addBreadcrumb } = require('../../utils/sentry.js');
const { statusFull } = require('../../utils/design-tokens.js');
const { wrapHandler } = require('../../utils/error-boundary.js');
const { checkCooldown } = require('../../utils/cooldown.js');

class AdminEditModalHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.ModalSubmit });
  }

  parse(interaction) {
    if (interaction.customId === 'admin:edit:modal') return this.some();
    return this.none();
  }

  async run(interaction) {
    return wrapHandler(async (interaction) => {
    addBreadcrumb('interaction', 'adminEditModal', {
      customId: interaction.customId,
      userId: interaction.user?.id,
    });
    const { guild, user } = interaction;
    if (!checkCooldown(user.id, 'admin_edit_modal', 5000)) {
      return interaction.reply({ content: '⏳ Vui lòng đợi một chút...', flags: MessageFlags.Ephemeral });
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const { ok } = await requireAdmin(interaction, { context: 'sửa điểm danh', deferred: true });
    if (!ok) return;

    const session = await getActiveSession(guild.id);
    if (!session) {
      return interaction.editReply({ content: '🚫 Không có Bang Chiến nào đang mở.' });
    }
    if (session.guild_id !== guild.id) {
      log.warn('ADMIN_EDIT', guild.id, 'SECURITY: guild mismatch user=%s', user.id);
      return interaction.editReply({ content: '❌ Bang Chiến không hợp lệ.' });
    }

    const userField = interaction.fields.getTextInputValue('user_id')?.trim();
    const statusField = interaction.fields.getTextInputValue('status')?.trim().toLowerCase();

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
    auditLog({ guildId: guild.id, actorId: user.id, action: 'ADMIN_EDIT', targetId: targetUserId, metadata: { status: resolvedStatus, sessionId: session.id } }).catch(() => {});

    const editEmbed = new EmbedBuilder()
      .setColor(0xf0a500)
      .setAuthor({ name: user.username, iconURL: user.displayAvatarURL({ size: 32 }) })
      .setTitle('🔧 Admin đã sửa điểm danh')
      .setDescription([
        `**${targetMember.displayName}** đã được cập nhật sang:`,
        `${statusFull(resolvedStatus)}`,
      ].join('\n'))
      .addFields(
        { name: 'Bang Chiến', value: `**${session.session_name ?? 'Bang Chiến'}**`, inline: true },
        { name: 'Người sửa', value: `<@${user.id}>`, inline: true },
      )
      .setTimestamp();

    return interaction.editReply({ embeds: [editEmbed] });
  }, 'AdminEditModalHandler')(interaction); }
}

module.exports = { AdminEditModalHandler };
