// interaction-handlers/attendanceSelect.js
// Handles: attendance:select (StringSelectMenu cho điểm danh)
// [B1] Thay thế button bằng select menu
// [A4] Refactor để dùng attendanceService.markAttendance()
'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const db = require('../db.js');
const { markAttendance } = require('../utils/attendanceService.js');

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
    const { guild, member, user, values } = interaction;
    const statusValue = values[0];
    const status = SELECT_TO_STATUS[statusValue];

    const session = await db.getActiveSession(guild.id);
    if (!session) {
      return interaction.reply({ content: '🚫 Không có phiên điểm danh nào đang mở.', ephemeral: true });
    }

    // [A4] Dùng shared service logic
    return markAttendance({ guild, member, user, status, interaction, session });
  }
}

module.exports = { AttendanceSelectHandler };
