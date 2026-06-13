// utils/_views/configView.js
// [FIX] Implement buildConfigEmbed(cfg, guild)
// Hiển thị cài đặt server: channel log, phai roles, timezone, auto-close
'use strict';
const { EmbedBuilder } = require('discord.js');
const { COLORS, ICONS, FOOTER_DEFAULT, buildAuthor } = require('../_helpers');

/**
 * @param {object} cfg   – guild config từ configService.getGuildConfig()
 * @param {import('discord.js').Guild} [guild]
 * @returns {EmbedBuilder}
 */
function buildConfigEmbed(cfg = {}, guild = null) {
  const channel   = cfg?.notification_channel_id ? `<#${cfg.notification_channel_id}>` : '_Chưa cài_';
  const tz        = cfg?.timezone ?? 'Asia/Ho_Chi_Minh';
  const autoClose = cfg?.auto_close_minutes
    ? `${cfg.auto_close_minutes} phút sau khi mở`
    : '_Tắt (đóng thủ công)_';

  const phaiRoleIds = cfg?.phai_role_ids ?? [];
  const phaiStr = phaiRoleIds.length
    ? phaiRoleIds.map(id => {
        const role = guild?.roles?.cache?.get(id);
        return role ? `<@&${id}> (${role.name})` : `<@&${id}>`;
      }).join(', ')
    : '_Tất cả thành viên_';

  const eligibleCount = cfg?.eligible_member_count ?? null;
  const memberStr = eligibleCount != null ? `**${eligibleCount}** người` : '_Chưa đồng bộ_';

  return new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setAuthor(buildAuthor(guild))
    .setTitle(`${ICONS.GEAR} Cài đặt Server`)
    .setDescription('Cấu hình hiện tại của bot điểm danh cho server này.')
    .addFields(
      { name: `${ICONS.BELL} Kênh thông báo`,    value: channel,   inline: true  },
      { name: `${ICONS.CLOCK} Timezone`,          value: `\`${tz}\``, inline: true  },
      { name: `${ICONS.GEAR} Tự đóng phiên`,      value: autoClose, inline: true  },
      { name: `${ICONS.SHIELD ?? '🛡️'} Phái quản lý`, value: phaiStr, inline: false },
      { name: `${ICONS.PERSON} Thành viên theo dõi`, value: memberStr, inline: true },
    )
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();
}

module.exports = { buildConfigEmbed };
