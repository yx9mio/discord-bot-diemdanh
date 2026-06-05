// utils/_views/configView.js — buildConfigEmbed
'use strict';
const { EmbedBuilder, MessageFlags } = require('discord.js');
const { COLORS, ICONS, FOOTER_DEFAULT } = require('../_helpers');

function buildConfigEmbed(cfg) {
  const val  = v => (v ? `<@&${v}>` : '*(chưa cài)*');
  const ch   = v => (v ? `<#${v}>` : '*(chưa cài)*');
  const num  = v => (v != null ? `\`${v}\`` : '*(chưa cài)*');
  const bool = v => (v ? '✅ Bật' : '⛔ Tắt');

  return {
    embeds: [
      new EmbedBuilder()
        .setColor(COLORS.BLUE)
        .setTitle(`${ICONS.GEAR} Cấu hình Server`)
        .addFields(
          { name: '👮 Role Admin',        value: val(cfg?.admin_role_id),       inline: true },
          { name: '📋 Role Điểm danh',    value: val(cfg?.attendance_role_id),  inline: true },
          { name: `${ICONS.SWORD} Role Phái`, value: val(cfg?.phai_role_id),   inline: true },
          { name: '📢 Channel thông báo', value: ch(cfg?.notify_channel_id),   inline: true },
          { name: '📅 Lịch cố định',      value: num(cfg?.fixed_schedule_count ?? cfg?.schedule_count), inline: true },
          { name: '🗂 Preset',            value: bool(cfg?.preset_active ?? cfg?.preset_enabled),       inline: true },
        )
        .setFooter({ text: FOOTER_DEFAULT })
        .setTimestamp(),
    ],
    flags: MessageFlags.Ephemeral,
  };
}

module.exports = { buildConfigEmbed };
