// utils/_views/attendView.js — buildAttendConfirmEmbed, buildAdminOverrideSuccessEmbed
'use strict';
const { EmbedBuilder, MessageFlags } = require('discord.js');
const { COLORS, ICONS, FOOTER_DEFAULT } = require('../_helpers');

// ─── Attend Confirm Embed ─────────────────────────────────────────────────────
function buildAttendConfirmEmbed(member, status, sessionName, streak) {
  const colorMap = {
    tham_gia:       COLORS.GREEN,
    tre:            COLORS.YELLOW,
    khong_tham_gia: COLORS.RED,
    co_phep:        COLORS.BLUE,
  };
  const labelMap = {
    tham_gia:       `${ICONS.ATTEND_YES} Đã điểm danh`,
    tre:            `${ICONS.ATTEND_LATE} Điểm danh trễ`,
    khong_tham_gia: `${ICONS.ATTEND_NO} Đã đăng ký vắng`,
    co_phep:        `${ICONS.ATTEND_EXCUSE} Nghỉ có phép`,
  };

  const nowTs = Math.floor(Date.now() / 1000);
  const name  = member?.displayName ?? member?.user?.username ?? 'Thành viên';

  const embed = new EmbedBuilder()
    .setColor(colorMap[status] ?? COLORS.GREY)
    .setTitle(labelMap[status] ?? status)
    .setDescription(`👤 **${name}** · 📋 ${sessionName}`)
    .addFields({ name: `${ICONS.CLOCK} Thời điểm`, value: `<t:${nowTs}:T>`, inline: true })
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();

  if (typeof member?.displayAvatarURL === 'function') {
    const url = member.displayAvatarURL({ dynamic: true, size: 64 });
    if (url) embed.setThumbnail(url);
  }

  if (streak != null && streak > 0 && ['tham_gia', 'tre'].includes(status)) {
    if (streak >= 3) {
      embed.addFields({ name: `${ICONS.FIRE} Streak`, value: `**${streak}** phiên liên tiếp`, inline: true });
    } else if (streak === 1) {
      embed.addFields({ name: `${ICONS.SPARKLE} Streak`, value: `Bắt đầu chuỗi mới!`, inline: true });
    } else {
      embed.addFields({ name: `${ICONS.FIRE} Streak`, value: `**${streak}** phiên liên tiếp`, inline: true });
    }
  }

  return { embeds: [embed], flags: MessageFlags.Ephemeral };
}

// ─── Admin Override Success Embed ─────────────────────────────────────────────
function buildAdminOverrideSuccessEmbed(targetUserId, oldStatus, newStatus, adminUserId) {
  const statusLabel = s => ({
    tham_gia:       `${ICONS.ATTEND_YES} Tham gia`,
    tre:            `${ICONS.ATTEND_LATE} Đến trễ`,
    khong_tham_gia: `${ICONS.ATTEND_NO} Vắng`,
    co_phep:        `${ICONS.ATTEND_EXCUSE} Có phép`,
  }[s] ?? s);

  const nowTs = Math.floor(Date.now() / 1000);

  return {
    embeds: [
      new EmbedBuilder()
        .setColor(COLORS.ORANGE)
        .setTitle('🛠️ Admin Override thành công')
        .addFields(
          { name: `${ICONS.PERSON} Thành viên`, value: `<@${targetUserId}>`, inline: true },
          { name: 'Trạng thái cũ → mới', value: `${statusLabel(oldStatus)} → **${statusLabel(newStatus)}**`, inline: true },
          { name: '👮 Admin', value: `<@${adminUserId}>`, inline: true },
          { name: `${ICONS.CLOCK} Thời điểm`, value: `<t:${nowTs}:f>`, inline: false },
        )
        .setFooter({ text: FOOTER_DEFAULT })
        .setTimestamp(),
    ],
    flags: MessageFlags.Ephemeral,
  };
}

module.exports = { buildAttendConfirmEmbed, buildAdminOverrideSuccessEmbed };
