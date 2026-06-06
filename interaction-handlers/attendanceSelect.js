// interaction-handlers/attendanceSelect.js
// Handles: attendance:select (StringSelectMenu cho điểm danh)
// [B1] Thay thế button bằng select menu
// [A4] Refactor để dùng attendanceHandler.markAttendance()
// [FIX-TIMEOUT] deferReply trước getActiveSession để tránh Discord 3s timeout
'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const { MessageFlags } = require('discord.js');
const { getActiveSession } = require('../services/sessionService.js');
const { markAttendance } = require('../utils/attendanceHandler.js');
const { addBreadcrumb } = require('../utils/sentry.js');

const SELECT_TO_STATUS = {
  'tham_gia':       'tham_gia',
  'tre':            'tre',
  'khong_tham_gia': 'khong_tham_gia',
  'co_phep':        'co_phep',
};

class AttendanceSelectHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.StringSelect });
  }

  parse(interaction) {
    if (interaction.customId === 'attendance:select') return this.some();
    return this.none();
  }

  async run(interaction) {
    // [D1]
    addBreadcrumb('interaction', 'attendanceSelect', {
      customId: interaction.customId,
      userId: interaction.user?.id,
    });

    const { guild, member, user, values } = interaction;
    const statusValue = values[0];
    const status = SELECT_TO_STATUS[statusValue];
    if (!status) {
      return interaction.reply({ content: '❌ Trạng thái điểm danh không hợp lệ.', flags: MessageFlags.Ephemeral });
    }

    // [FIX-TIMEOUT] Defer ngay trước khi gọi DB — tránh Discord 3s timeout
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const session = await getActiveSession(guild.id);
    if (!session) {
      return interaction.editReply({ content: '🚫 Không có phiên điểm danh nào đang mở.' });
    }

    // [A4] Dùng shared handler logic — truyền thêm deferred: true
    return markAttendance({ guild, member, user, status, interaction, session, deferred: true });
  }
}

module.exports = { AttendanceSelectHandler };
