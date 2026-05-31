// commands/huy.js
'use strict';
const { SlashCommandBuilder } = require('discord.js');
const db = require('../db.js');
const { replyConfirm, replyOkEdit, replyWarnEdit, replyErrEdit } = require('../utils/embeds.js');
const { requireAdmin }          = require('../utils/permissions.js');
const { voHieuHoaNutDiemDanh } = require('../utils/session.js');
const { xoaHenGio }             = require('../utils/timers.js');

const CONFIRM_ID = 'confirm:huy:yes';
const CANCEL_ID  = 'confirm:huy:no';
const TIMEOUT_MS = 30_000;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('huy')
    .setDescription('Hủy phiên điểm danh đang mở (không lưu kết quả)'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guild, channel, user } = interaction;

    const { ok } = await requireAdmin(interaction, { context: '/huy' });
    if (!ok) return;

    const session = await db.getActiveSession(guild.id);
    if (!session) return interaction.editReply(replyWarnEdit('📭 Không có phiên nào đang mở.'));

    const attended  = await db.getAttendances(session.id);
    const confirmed = attended.filter(a => ['tham_gia', 'tre'].includes(a.status)).length;

    // Gửi embed xác nhận
    await interaction.editReply(
      replyConfirm(
        `Bạn có chắc muốn **hủy** phiên \"${session.session_name}\"?\n` +
        `> ${confirmed} thành viên đã điểm danh sẽ **không được lưu**.`,
        CONFIRM_ID,
        CANCEL_ID,
      )
    );

    // Collector chỉ lắng nghe user hiện tại
    const reply     = await interaction.fetchReply();
    const collector = reply.createMessageComponentCollector({
      filter: i => i.user.id === user.id,
      max: 1,
      time: TIMEOUT_MS,
    });

    collector.on('collect', async i => {
      await i.deferUpdate();

      if (i.customId === CONFIRM_ID) {
        // Kiểm tra lại phiên vẫn còn (ai đó có thể đã đóng trước)
        const stillActive = await db.getActiveSession(guild.id);
        if (!stillActive || stillActive.id !== session.id) {
          return interaction.editReply({ ...replyWarnEdit('📭 Phiên này đã được xử lý trước đó.'), components: [] });
        }
        await db.cancelSession(session.id);
        await voHieuHoaNutDiemDanh(interaction.client, channel, session);
        xoaHenGio(guild.id);
        return interaction.editReply({ ...replyOkEdit(`Đã hủy phiên **${session.session_name}**.`), components: [] });
      }

      // Cancel
      return interaction.editReply({ ...replyWarnEdit('Đã hủy thao tác. Phiên điểm danh vẫn tiếp tục.'), components: [] });
    });

    collector.on('end', async (collected, reason) => {
      if (reason === 'time' && collected.size === 0) {
        await interaction.editReply({ ...replyWarnEdit('⏰ Hết thời gian xác nhận. Phiên điểm danh vẫn tiếp tục.'), components: [] }).catch(() => null);
      }
    });
  },
};
