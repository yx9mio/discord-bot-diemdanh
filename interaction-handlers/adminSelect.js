// interaction-handlers/adminSelect.js
// [C1] Handler cho admin dashboard StringSelectMenu + Button actions
'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const db = require('../db.js');
const log = require('../utils/logger.js');
const { buildCsvBuffer, buildCsvFilename } = require('../utils/csvHelper.js');
const {
  buildSessionEmbed,
  buildSessionActionRow,
  buildSummaryEmbed,
  replyOkEdit,
  replyErrEdit,
  replyConfirm,
} = require('../utils/embeds.js');
const { ketThucPhien, thongBaoHuyHieu, voHieuHoaNutDiemDanh } = require('../utils/session.js');
const { xoaHenGio, stopAutoRefresh } = require('../utils/timers.js');
const { buildAdminMarkModal } = require('../utils/adminMarkModal.js');
const { requireAdmin } = require('../utils/permissions.js');

const ADMIN_BUTTON_IDS = new Set(['admin:confirm_close', 'admin:cancel_close']);

class AdminSelectHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: [InteractionHandlerTypes.StringSelect, InteractionHandlerTypes.Button] });
  }

  parse(interaction) {
    if (ADMIN_BUTTON_IDS.has(interaction.customId)) return this.some();
    if (interaction.customId === 'admin:select') return this.some();
    return this.none();
  }

  async run(interaction) {
    const { customId, guild, values } = interaction;

    // Button actions
    if (customId === 'admin:confirm_close') {
      const { channel } = interaction;
      await interaction.deferUpdate();
      const session = await db.getActiveSession(guild.id);
      if (!session) return interaction.editReply(replyErrEdit('🚫 Phiên đã được đóng trước đó.'));

      try {
        stopAutoRefresh(session.id); // [C3]
        await db.closeSession(session.id);
      } catch (e) {
        log.error('ADMIN_CLOSE', guild.id, 'closeSession thất bại %s: %s', session.id, e.message);
        return interaction.editReply(replyErrEdit('❌ Không thể đóng phiên do lỗi DB, thử lại sau.'));
      }

      const attended = await db.getAttendances(session.id);
      xoaHenGio(guild.id);
      const statsMap = await ketThucPhien(guild, session, attended);
      await voHieuHoaNutDiemDanh(interaction.client, channel, session, attended);
      await channel.send({ embeds: [buildSummaryEmbed(session, attended, guild)] });
      await thongBaoHuyHieu(guild, channel, guild.id, session.id, attended, statsMap);
      return interaction.editReply(replyOkEdit('✅ Phiên điểm danh đã được đóng thành công.'));
    }

    if (customId === 'admin:cancel_close') {
      return interaction.update({ content: '↩️ Đã hủy. Phiên vẫn đang mở.', embeds: [], components: [] });
    }

    // StringSelect actions
    const action = values[0];

    if (action === 'view_attendance') {
      const session = await db.getActiveSession(guild.id);
      if (!session) return interaction.reply({ content: '🚫 Không có phiên điểm danh nào đang mở.', ephemeral: true });
      const attended = await db.getAttendances(session.id);
      const { embed } = await buildSessionEmbed(guild, session, attended, session.phai_role_ids ?? []);
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (action === 'mark_attendance') {
      const { ok } = await requireAdmin(interaction, { context: 'điểm danh thay' });
      if (!ok) return;
      const session = await db.getActiveSession(guild.id);
      if (!session) return interaction.reply({ content: '🚫 Không có phiên điểm danh nào đang mở.', ephemeral: true });
      // [C1] Mở modal điểm danh thay (dùng chung builder với sessionButton)
      return interaction.showModal(buildAdminMarkModal());
    }

    if (action === 'export_csv') {
      const session = await db.getActiveSession(guild.id);
      if (!session) return interaction.reply({ content: '🚫 Không có phiên điểm danh nào đang mở.', ephemeral: true });

      const attended = await db.getAttendances(session.id);
      if (!attended.length) return interaction.reply({ content: '🚫 Chưa có ai điểm danh trong phiên này.', ephemeral: true });

      try {
        const csvBuffer = buildCsvBuffer(attended);
        const filename = buildCsvFilename(session.session_name ?? session.id, session.id);
        return interaction.reply({
          content: `📄 File CSV điểm danh phiên **${session.session_name}** (${attended.length} bản ghi)`,
          files: [{ attachment: csvBuffer, name: filename }],
          ephemeral: true,
        });
      } catch (e) {
        log.error('ADMIN_EXPORT_CSV', guild.id, 'Lỗi tạo CSV: %s', e.message);
        return interaction.reply({ content: '❌ Không thể tạo file CSV, thử lại sau.', ephemeral: true });
      }
    }

    if (action === 'refresh_embed') {
      const session = await db.getActiveSession(guild.id);
      if (!session) return interaction.reply({ content: '🚫 Không có phiên điểm danh nào đang mở.', ephemeral: true });

      try {
        const attended = await db.getAttendances(session.id);
        await interaction.guild.members.fetch().catch(() => {});
        const { embed } = await buildSessionEmbed(interaction.guild, session, attended, session.phai_role_ids ?? []);
        const components = buildSessionActionRow(false);

        if (session.channel_id && session.message_id) {
          const ch = interaction.guild.channels.cache.get(session.channel_id);
          if (ch) {
            const msg = await ch.messages.fetch(session.message_id).catch(() => null);
            if (msg) {
              await msg.edit({ embeds: [embed], components }).catch(() => null);
            }
          }
        }
        return interaction.reply({ content: '✅ Embed đã được làm mới.', ephemeral: true });
      } catch (e) {
        log.error('ADMIN_REFRESH', guild.id, 'Lỗi làm mới embed: %s', e.message);
        return interaction.reply({ content: '❌ Không thể làm mới embed, thử lại sau.', ephemeral: true });
      }
    }

    if (action === 'close_session') {
      const session = await db.getActiveSession(guild.id);
      if (!session) return interaction.reply({ content: '🚫 Không có phiên điểm danh nào đang mở.', ephemeral: true });
      return interaction.reply(
        replyConfirm(
          `Bạn có chắc muốn đóng phiên **"${session.session_name}"**?\n> Hành động này không thể hoàn tác.`,
          'admin:confirm_close',
          'admin:cancel_close',
        ),
      );
    }

    return interaction.reply({ content: `❌ Hành động không xác định: ${action}`, ephemeral: true });
  }
}

module.exports = { AdminSelectHandler };
