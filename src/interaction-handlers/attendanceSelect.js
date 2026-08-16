// src/interaction-handlers/attendanceSelect.js
// Handles: attendance:select (StringSelect) — user tự điểm danh từ select menu
// [UX-P2] Flow 2 bước: chọn trạng thái → xác nhận riêng (✅ / ↩️) → ghi nhận.
//   Không ghi DB ngay tại bước này; việc ghi do AttendanceConfirmHandler đảm nhận.
'use strict';
const { MessageFlags } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const sessionService    = require('../../services/sessionService.js');
const configService     = require('../../services/configService.js');
const log               = require('../../utils/logger.js');
const { buildAttendanceConfirmPrompt, buildAttendanceConfirmRow } = require('../../utils/embeds.js');
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
      return interaction.reply({ content: '🚫 Không có Bang Chiến nào đang mở.', flags: MessageFlags.Ephemeral });
    }

    // [SEC-FIX-2] Validate session thuộc đúng guild
    if (session.guild_id !== guild.id) {
      log.warn('SECURITY', guild.id,
        'attendanceSelect: guild mismatch session.guild_id=%s guild.id=%s user=%s',
        session.guild_id, guild.id, user.id);
      return interaction.reply({ content: '❌ Bang Chiến không hợp lệ.', flags: MessageFlags.Ephemeral });
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

    // [UX-P2] Bước 1: chỉ hiện xác nhận — chưa ghi DB
    log.info('ATTEND_SELECT', guild.id, '%s chọn trạng thái: %s (chờ xác nhận)', user.tag, status);
    return interaction.editReply({
      ...buildAttendanceConfirmPrompt(status, session.session_name),
      components: [buildAttendanceConfirmRow(session.id, status)],
    });
  }, 'AttendanceSelectHandler')(interaction); }
}

module.exports = { AttendanceSelectHandler };