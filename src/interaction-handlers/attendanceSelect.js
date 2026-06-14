// src/interaction-handlers/attendanceSelect.js
// Handles: attendance:select (StringSelect) — user tự điểm danh từ select menu
// [BUG-E] Fix customId mismatch: 'attendance_select' → 'attendance:select'
//         rows.js tạo StringSelectMenu với customId 'attendance:select'
//         nhưng parse() check 'attendance_select' → không bao giờ match → timeout
'use strict';
const { MessageFlags } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const sessionService    = require('../../services/sessionService.js');
const attendanceService = require('../../services/attendanceService.js');
const configService     = require('../../services/configService.js');
const log               = require('../../utils/logger.js');
const { getSessionChannel } = require('../../utils/channel.js');
const { replyErr, buildSessionEmbed, buildAttendanceSelectRow, buildSessionActionRow, buildAttendConfirmEmbed } = require('../../utils/embeds.js');
const { checkCooldown } = require('../../utils/cooldown.js');
const { wrapHandler } = require('../../utils/error-boundary.js');

const SELECT_CUSTOM_ID = 'attendance:select';

class AttendanceSelectHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.SelectMenu });
  }

  parse(interaction) {
    if (interaction.customId === SELECT_CUSTOM_ID) return this.some();
    return this.none();
  }

  async run(interaction) {
    return wrapHandler(async (interaction) => {
    const { guild, user } = interaction;
    const status = interaction.values[0];

    const session = await sessionService.getActiveSession(guild.id);
    if (!session) {
      return interaction.reply({ content: '🚫 Không có phiên điểm danh nào đang mở.', flags: MessageFlags.Ephemeral });
    }

    // [SEC-FIX-2] Validate session thuộc đúng guild
    if (session.guild_id !== guild.id) {
      log.warn('SECURITY', guild.id,
        'attendanceSelect: guild mismatch session.guild_id=%s guild.id=%s user=%s',
        session.guild_id, guild.id, user.id);
      return interaction.reply({ content: '❌ Phiên không hợp lệ.', flags: MessageFlags.Ephemeral });
    }

    // Kiểm tra phái role — nếu chưa có, bắt chọn phái trước
    const phaiRoleIds = session.phai_role_ids?.length
      ? session.phai_role_ids
      : (await configService.getGuildConfig(guild.id).catch(() => null))?.phai_role_ids ?? [];
    if (phaiRoleIds.length > 0) {
      const member = await guild.members.fetch(user.id).catch(() => null);
      const hasPhai = member && phaiRoleIds.some(rid => member.roles.cache.has(rid));
      if (!hasPhai) {
        const roles = phaiRoleIds.map(rid => guild.roles.cache.get(rid)).filter(Boolean);
        if (roles.length) {
          const { StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder } = require('discord.js');
          const select = new StringSelectMenuBuilder()
            .setCustomId(`phai:select:${status}`)
            .setPlaceholder('👤 Chọn phái / nhóm của bạn...')
            .addOptions(
              roles.map(r => {
                const opt = new StringSelectMenuOptionBuilder().setLabel(r.name).setValue(r.id);
                try { opt.setEmoji(r.icon || '👤'); } catch (_) {}
                return opt;
              }),
            );
          return interaction.reply({
            content: '⚠️ Bạn chưa có **role phái**. Vui lòng chọn phái của bạn:',
            components: [new ActionRowBuilder().addComponents(select)],
            flags: MessageFlags.Ephemeral,
          });
        }
      }
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!checkCooldown(user.id, 'attendance', 2000)) {
      return interaction.editReply({ content: '⏳ Bạn đang thao tác quá nhanh, vui lòng chậm lại...' });
    }

    const acquired = await attendanceService.tryAcquireAttendanceLock(session.id, user.id);
    if (!acquired) {
      return interaction.editReply({ content: '⏳ Đang xử lý điểm danh của bạn, vui lòng chờ...' });
    }

    try {
      const memberData = await guild.members.fetch(user.id).catch(() => null);

      // upsertAttendance dùng snake_case, idempotent (onConflict update)
      await attendanceService.upsertAttendance({
        session_id:    session.id,
        user_id:       user.id,
        guild_id:      guild.id,
        status,
        username:      memberData?.nickname ?? user.displayName ?? user.username,
        marked_by:     user.id,
        checked_in_at: new Date().toISOString(),
      });

      let attended;
      try {
        const ch = await getSessionChannel(guild, session);
        if (ch && session.message_id) {
          const msg = await ch.messages.fetch(session.message_id).catch(() => null);
          if (msg) {
            attended = await attendanceService.getAttendances(session.id);
            const cfg7 = await configService.getGuildConfig(guild.id).catch(() => null);
            const phaiIds = session.phai_role_ids?.length
              ? session.phai_role_ids
              : cfg7?.phai_role_ids ?? [];
            const { embed, components: pagComponents } = buildSessionEmbed(
              guild, session, attended, phaiIds, false, 1, cfg7?.phai_role_icons ?? null
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
        log.error('ATTEND', guild.id, 'Lỗi update embed: %s', e.message);
      }

      const sTotal = attended?.length ?? 0;
      const sJoined = sTotal > 0 ? attended.filter(a => a.status === 'tham_gia' || a.status === 'tre').length : 0;

      log.info('ATTEND', guild.id, '%s điểm danh: %s', user.tag, status);
      return interaction.editReply(buildAttendConfirmEmbed(memberData, status, session.session_name, 0, sTotal, sJoined));
    } catch (e) {
      log.error('ATTEND', guild.id, 'Lỗi upsertAttendance: %s', e.message);
      return interaction.editReply(replyErr('❌ Không thể ghi nhận điểm danh, thử lại sau.'));
    } finally {
      await attendanceService.releaseAttendanceLock(session.id, user.id).catch(() => {});
    }
  }, 'AttendanceSelectHandler')(interaction); }
}

module.exports = { AttendanceSelectHandler };
