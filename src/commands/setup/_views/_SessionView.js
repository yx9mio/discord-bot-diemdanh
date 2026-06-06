// src/commands/setup/_views/_SessionView.js
// [Phase-C] SessionView — hiển thị phiên điểm danh hiện tại + nút điều khiển
'use strict';
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { COLORS, ICONS }  = require('../../../../utils/theme.js');
const { FOOTER_DEFAULT } = require('../../../../utils/embeds.js');
const { fmtTs }          = require('../../../../utils/format.js');

const CUSTOM_ID = {
  SESSION_START:   'setup:session:start',
  SESSION_CLOSE:   'setup:session:close',
  SESSION_EXPORT:  'setup:session:export',
  SESSION_REFRESH: 'setup:session:refresh',
  BACK_HOME:       'setup:home',
};

/**
 * @param {object} opts
 * @param {import('discord.js').Guild}  opts.guild
 * @param {object|null}                 opts.session  - phiên đang mở (null nếu chưa có)
 * @param {object|null}                 opts.cfg      - guild config
 * @param {object[]}                    opts.members  - danh sách thành viên
 */
function render({ guild, session, cfg, members = [] }) {
  const isActive = !!session;

  // ─── Build embed ───
  const embed = new EmbedBuilder()
    .setColor(isActive ? COLORS.SUCCESS : COLORS.PRIMARY)
    .setTitle(`${isActive ? '\uD83D\uDFE2' : '\u26AA'} Phiên điểm danh — ${guild.name}`)
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();

  if (isActive) {
    const totalEligible = session.eligible_count ?? members.length;
    const totalIn       = session.attended_count  ?? 0;
    const totalLate     = session.late_count       ?? 0;
    const totalAbsent   = session.absent_count     ?? 0;
    const pct = totalEligible > 0 ? Math.round((totalIn / totalEligible) * 100) : 0;
    const bar = _progressBar(totalIn, totalEligible);

    embed.setDescription(
      `### ✅ Phiên đang mở\n` +
      `**${session.session_name ?? 'Phiên điểm danh'}**\n` +
      (session.description ? `_${session.description}_\n` : '') +
      `\n${bar} **${pct}%**`,
    );
    embed.addFields(
      { name: `${ICONS.ID} Session ID`,     value: `\`${session.id}\``,                             inline: true },
      { name: `⏱️ Bắt đầu`,              value: fmtTs(session.started_at),                      inline: true },
      { name: `👥 Bắt buộc`,             value: `${totalEligible} thành viên`,                    inline: true },
      { name: `✅ Đúng giờ`,             value: `${totalIn}`,                                    inline: true },
      { name: `⏰ Trễ`,                  value: `${totalLate}`,                                  inline: true },
      { name: `❌ Vắng`,                 value: `${totalAbsent}`,                                 inline: true },
    );
    if (cfg?.notification_channel_id) {
      embed.addFields({ name: `📢 Kênh điểm danh`, value: `<#${cfg.notification_channel_id}>`, inline: true });
    }
  } else {
    embed.setDescription(
      `### ⚪ Chưa có phiên nào đang mở\n` +
      `Nhấn **Mở phiên** để bắt đầu điểm danh.\n\n` +
      `> 💡 Bạn có thể đặt tên, thêm mô tả, giới hạn role và thời gian tự đóng sau khi mở.`,
    );
    if (members.length > 0) {
      embed.addFields({ name: `👥 Thành viên hiện tại`, value: `${members.length} người`, inline: true });
    }
  }

  // ─── Build components ───
  const row1 = new ActionRowBuilder();

  if (isActive) {
    row1.addComponents(
      new ButtonBuilder()
        .setCustomId(CUSTOM_ID.SESSION_CLOSE)
        .setLabel('\u23F9️ Đóng phiên')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(CUSTOM_ID.SESSION_EXPORT)
        .setLabel('\ud83d\udce4 Xuất CSV')
        .setStyle(ButtonStyle.Secondary),
    );
  } else {
    row1.addComponents(
      new ButtonBuilder()
        .setCustomId(CUSTOM_ID.SESSION_START)
        .setLabel('\ud83d\udfe2 Mở phiên')
        .setStyle(ButtonStyle.Success),
    );
  }

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.SESSION_REFRESH)
      .setLabel('Làm mới')
      .setEmoji(ICONS.REFRESH)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.BACK_HOME)
      .setLabel('← Dashboard')
      .setEmoji(ICONS.HOME)
      .setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row1, row2] };
}

/** Mini progress bar 10 bước */
function _progressBar(value, max) {
  if (!max || max <= 0) return '░'.repeat(10);
  const filled = Math.round((value / max) * 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

module.exports = { SessionView: { render, CUSTOM_ID } };
