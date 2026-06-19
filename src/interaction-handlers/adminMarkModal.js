// interaction-handlers/adminMarkModal.js
// [B3] Modal cho admin điểm danh thay cho member khác
// [BUG-E] Guard role mention <@&...> để tránh fetch member với role ID
// [EDIT] Thêm update embed sau khi điểm danh (giống attendanceSelect.js pattern)
'use strict';
const { MessageFlags, EmbedBuilder } = require('discord.js');
const {
  InteractionHandler, InteractionHandlerTypes,
} = require('@sapphire/framework');
const { getActiveSession } = require('../../services/sessionService.js');
const { getAttendances, upsertAttendance } = require('../../services/attendanceService.js');
const configService = require('../../services/configService.js');
const log = require('../../utils/logger.js');
const metrics = require('../../utils/metrics.js');
const { requireAdmin } = require('../../utils/permissions.js');
const { auditLog } = require('../../utils/auditLog.js');
const { addBreadcrumb } = require('../../utils/sentry.js');
const { getSessionChannel } = require('../../utils/channel.js');
const { buildSessionEmbed, buildAttendanceSelectRow, buildSessionActionRow } = require('../../utils/embeds.js');
const { statusFull } = require('../../utils/design-tokens.js');
const { wrapHandler } = require('../../utils/error-boundary.js');
const { checkCooldown } = require('../../utils/cooldown.js');

class AdminMarkModalHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.ModalSubmit });
  }

  parse(interaction) {
    if (interaction.customId === 'admin:mark:modal') return this.some();
    return this.none();
  }

  async run(interaction) {
    return wrapHandler(async (interaction) => {
    addBreadcrumb('interaction', 'adminMarkModal', {
      customId: interaction.customId,
      userId: interaction.user?.id,
    });
    const { guild, user } = interaction;
    if (!checkCooldown(user.id, 'admin_mark_modal', 5000)) {
      return interaction.reply({ content: '⏳ Vui lòng đợi một chút...', flags: MessageFlags.Ephemeral });
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const { ok } = await requireAdmin(interaction, { context: 'điểm danh thay', deferred: true });
    if (!ok) return;

    const session = await getActiveSession(guild.id);
    if (!session) {
      return interaction.editReply({ content: '🚫 Không có Bang Chiến nào đang mở.' });
    }

    // [BUG-12] Defensive assert — lớp bảo vệ thứ hai bổ sung cho getActiveSession
    if (session.guild_id !== guild.id) {
      log.warn('ADMIN_MARK', guild.id, 'SECURITY: session.guild_id=%s !== guild.id=%s user=%s', session.guild_id, guild.id, user.id);
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
    const status = resolvedStatus;

    // [BUG-E] Guard: từ chối role mention <@&roleId>
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
      return interaction.editReply({ content: '❌ Không thể điểm danh cho bot.' });
    }

    const username = targetMember.nickname ?? targetMember.user.displayName ?? targetMember.user.username;

    try {
      await upsertAttendance({
        session_id:    session.id,
        guild_id:      guild.id,
        user_id:       targetUserId,
        username,
        status,
        marked_by:     user.id,
        checked_in_at: new Date().toISOString(),
      });
    } catch (e) {
      log.error('ADMIN_MARK', guild.id, 'upsertAttendance thất bại: %s', e.message);
      return interaction.editReply({ content: '❌ Không thể lưu điểm danh, thử lại sau.' });
    }

    metrics.attendanceMarked(guild.id, status, { markedBy: 'admin' });
    log.info('ADMIN_MARK', guild.id, '%s điểm danh thay cho %s: %s', user.tag, targetUserId, status);
    auditLog({ guildId: guild.id, actorId: user.id, action: 'ADMIN_MARK', targetId: targetUserId, metadata: { status, sessionId: session.id } }).catch(() => {});

    // Update embed trong kênh
    try {
      const ch = await getSessionChannel(guild, session);
      if (ch && session.message_id) {
        const msg = await ch.messages.fetch(session.message_id).catch(() => null);
        if (msg) {
          const attended = await getAttendances(session.id);
          await guild.members.fetch().catch(() => {});
          await guild.roles.fetch().catch(() => {});
          const cfgA1 = await configService.getGuildConfig(guild.id).catch(() => null);
          const phaiIds = session.phai_role_ids?.length
            ? session.phai_role_ids
            : cfgA1?.phai_role_ids ?? [];
          const { embed, components: pagComponents } = buildSessionEmbed(
            guild, session, attended, phaiIds, false, 1, cfgA1?.phai_role_icons ?? null
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
      log.error('ADMIN_MARK', guild.id, 'Lỗi update embed: %s', e.message);
    }

    const confirmEmbed = new EmbedBuilder()
      .setColor(0x57f287)
      .setAuthor({ name: user.username, iconURL: user.displayAvatarURL({ size: 32 }) })
      .setTitle(`✅ Admin điểm danh thay`)
      .setDescription([
        `**${targetMember.displayName}** đã được điểm danh với trạng thái:`,
        `${statusFull(status)}`,
      ].join('\n'))
      .addFields(
        { name: 'Bang Chiến', value: `**${session.session_name ?? 'Bang Chiến'}**`, inline: true },
        { name: 'Người điểm danh', value: `<@${user.id}>`, inline: true },
      )
      .setTimestamp();

    return interaction.editReply({ embeds: [confirmEmbed] });
  }, 'AdminMarkModalHandler')(interaction); }
}

module.exports = { AdminMarkModalHandler };
