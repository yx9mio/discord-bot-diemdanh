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
const log               = require('../../utils/logger.js');
const { replyErr }      = require('../../utils/embeds.js');

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
    const { guild, user } = interaction;
    const status = interaction.values[0];

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const session = await sessionService.getActiveSession(guild.id);
    if (!session) {
      return interaction.editReply({ content: '🚫 Không có phiên điểm danh nào đang mở.' });
    }

    // [SEC-FIX-2] Validate session thuộc đúng guild
    if (session.guild_id !== guild.id) {
      log.warn('SECURITY', guild.id,
        'attendanceSelect: guild mismatch session.guild_id=%s guild.id=%s user=%s',
        session.guild_id, guild.id, user.id);
      return interaction.editReply({ content: '❌ Phiên không hợp lệ.' });
    }

    // [BUG-LOCK] sync lock — không dùng await
    const acquired = attendanceService.tryAcquireAttendanceLock(session.id, user.id);
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

      const statusLabel = {
        tham_gia:       '✅ Tham gia',
        tre:            '⏰ Trễ',
        co_phep:        '📋 Có phép',
        khong_tham_gia: '❌ Không tham gia',
      }[status] ?? status;

      log.info('ATTEND', guild.id, '%s điểm danh: %s', user.tag, status);
      return interaction.editReply({ content: `${statusLabel} — Đã ghi nhận điểm danh của bạn.` });
    } catch (e) {
      log.error('ATTEND', guild.id, 'Lỗi upsertAttendance: %s', e.message);
      return interaction.editReply(replyErr('❌ Không thể ghi nhận điểm danh, thử lại sau.'));
    } finally {
      // [BUG-LOCK] sync release — không dùng await/.catch()
      attendanceService.releaseAttendanceLock(session.id, user.id);
    }
  }
}

module.exports = { AttendanceSelectHandler };
