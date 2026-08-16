'use strict';
const { EmbedBuilder } = require('discord.js');
const { STATUS_CONFIG, statusFull } = require('../design-tokens');
const { getPhaiIcon } = require('../theme.js');
const { buildSessionEmbed } = require('./sessionView.js');
const { buildAttendanceSelectRow } = require('./rows.js');
const attendanceService = require('../../services/attendanceService.js');
const configService     = require('../../services/configService.js');

function buildAttendConfirmEmbed(member, status, sessionName, streak = 0, sessionTotal = 0, sessionJoined = 0) {
  const sc = STATUS_CONFIG[status];
  const label = sc ? `${sc.emoji} ${sc.label}` : `❓ ${status}`;
  const baseColor = sc?.color ?? 0x5865f2;

  // Color gradient by streak
  const color = streak >= 10 ? 0xFFD700
    : streak >= 5  ? 0x57f287
    : streak >= 3  ? 0xfee75c
    : baseColor;

  const displayName = member?.nickname ?? member?.user?.displayName ?? member?.user?.username ?? 'Bạn';

  const descParts = [
    `**${displayName}** đã điểm danh phần **${sessionName}**`,
  ];
  if (sessionTotal > 0) {
    const pct = Math.round(sessionJoined / sessionTotal * 100);
    descParts.push(`📊 Tỷ lệ Kỳ: **${sessionJoined}/${sessionTotal}** (${pct}%)`);
  }

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(label)
    .setDescription(descParts.join('\n'))
    .setTimestamp();

  if (streak > 0) {
    embed.setFooter({ text: `🔥 Streak hiện tại: ${streak} buổi liên tiếp` });
  }

  return { embeds: [embed] };
}

function buildAdminOverrideSuccessEmbed(targetUsername, status, sessionName) {
  const label = statusFull(status);
  const embed = new EmbedBuilder()
    .setColor(0xf0a500)
    .setTitle('🔧 Admin đã cập nhật điểm danh')
    .setDescription(`Đã điểm danh cho **${targetUsername ?? 'user'}**: ${label}\nKỳ: **${sessionName ?? ''}**`)
    .setTimestamp();

  return { embeds: [embed] };
}

/** [UX-P2] Prompt xác nhận riêng — hiện status đã chọn trước khi ghi nhận */
function buildAttendanceConfirmPrompt(status, sessionName) {
  const sc = STATUS_CONFIG[status];
  const label = sc ? `${sc.emoji} ${sc.label}` : `❓ ${status}`;
  const embed = new EmbedBuilder()
    .setColor(sc?.color ?? 0x5865f2)
    .setTitle('❓ Xác nhận điểm danh')
    .setDescription(
      `Bạn chọn **${label}** cho Kỳ **"${sessionName ?? ''}"**.\n\n` +
      `> ✅ Ấn **Xác nhận** để ghi nhận, hoặc **Đổi trạng thái** để chọn lại.`
    )
    .setTimestamp();

  return { embeds: [embed] };
}

/** [UX-P2] Dòng trạng thái bản thân: 'Hiện tại: chưa điểm danh' / 'Hiện tại: ✅ Đúng giờ · <phái>' */
function _userStatusLine(guild, userId, attended, phaiRoleIds, emojiMap) {
  const member = guild?.members?.cache?.get(userId);
  const record = attended.find(a => a.user_id === userId);
  if (!record || !STATUS_CONFIG[record.status]) return '👤 Hiện tại: **chưa điểm danh**';
  const sc = STATUS_CONFIG[record.status];
  const phaiIcons = (phaiRoleIds ?? [])
    .filter(rid => member?.roles?.cache?.has(rid))
    .map(rid => getPhaiIcon(rid, phaiRoleIds, guild, emojiMap))
    .join('');
  return `👤 Hiện tại: ${sc.emoji} **${sc.label}**${phaiIcons ? ` · ${phaiIcons}` : ''}`;
}

/**
 * [UX-P2] Render phiếu điểm danh cá nhân (ephemeral per-user):
 * embed + dòng trạng thái bản thân + select menu (+ pagination nếu có list).
 * @param {object} guild
 * @param {object} session
 * @param {{ page?: number, userId?: string, selectEnabled?: boolean }} [opts]
 */
async function renderAttendancePanel(guild, session, opts = {}) {
  const { page = 1, userId = null, selectEnabled = true } = opts;

  const [attended, cfg] = await Promise.all([
    attendanceService.getAttendances(session.id),
    configService.getGuildConfig(guild.id).catch(() => null),
  ]);
  const phaiRoleIds = session.phai_role_ids?.length
    ? session.phai_role_ids
    : cfg?.phai_role_ids ?? [];
  const emojiMap = cfg?.phai_role_icons ?? null;

  const userLine = userId
    ? _userStatusLine(guild, userId, attended, phaiRoleIds, emojiMap)
    : null;

  const { embed, components: pagComponents } = buildSessionEmbed(
    guild, session, attended, phaiRoleIds, false, page, emojiMap, true,
    { showList: false, sessionId: session.id, userLine },
  );

  return {
    embed,
    components: [buildAttendanceSelectRow(selectEnabled), ...pagComponents],
    attended,
    phaiRoleIds,
    emojiMap,
  };
}

module.exports = { buildAttendConfirmEmbed, buildAdminOverrideSuccessEmbed, buildAttendanceConfirmPrompt, renderAttendancePanel };
