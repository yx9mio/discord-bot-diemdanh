// utils/embeds.js — Tất cả embed builders & button builders
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { buildProgressBar } = require('./progress.js');

// ─── Constants ──────────────────────────────────────────────────────────────
const COLOR_HIGH   = 0x57F287;
const COLOR_MID    = 0xFEE75C;
const COLOR_LOW    = 0xED4245;
const COLOR_ACTIVE = 0x5865F2;
const COLOR_GREY   = 0x99AAB5;
const COLOR_GOLD   = 0xF0B132;

const FOOTER_DEFAULT = 'Quản Gia';
const AUTHOR_DEFAULT = { name: '📋 Quản Gia · Điểm Danh' };

// ─── Helpers ─────────────────────────────────────────────────────────────────
function pctColor(pct) {
  if (pct >= 80) return COLOR_HIGH;
  if (pct >= 50) return COLOR_MID;
  return COLOR_LOW;
}

function pctEmoji(pct) {
  if (pct >= 80) return '🟢';
  if (pct >= 50) return '🟡';
  return '🔴';
}

function pctLabel(pct) {
  if (pct >= 90) return 'Xuất sắc';
  if (pct >= 80) return 'Tốt';
  if (pct >= 60) return 'Khá';
  if (pct >= 40) return 'Trung bình';
  return 'Thấp';
}

function chunkLines(lines, maxLen = 950) {
  const chunks = [];
  let cur = '';
  for (const line of lines) {
    const next = cur ? cur + '\n' + line : line;
    if (next.length > maxLen) {
      if (cur) chunks.push(cur);
      cur = line;
    } else {
      cur = next;
    }
  }
  if (cur) chunks.push(cur);
  return chunks;
}

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}g ${m}p`;
  if (m > 0) return `${m} phút`;
  return `${seconds % 60} giây`;
}

// ─── Buttons ─────────────────────────────────────────────────────────────────
function buildAttendanceButtons(disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('attend_yes')
      .setLabel('Tham Gia')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId('attend_late')
      .setLabel('Đến Trễ')
      .setEmoji('⏰')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId('attend_no')
      .setLabel('Vắng Mặt')
      .setEmoji('❌')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId('attend_view')
      .setLabel('Xem Danh Sách')
      .setEmoji('📋')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(false),
  );
}

// ─── Session Embed (đang mở) ──────────────────────────────────────────────────
async function buildSessionEmbed(guild, session, attended) {
  const joined   = attended.filter(a => a.status === 'tham_gia');
  const late     = attended.filter(a => a.status === 'tre');
  const declined = attended.filter(a => a.status === 'khong_tham_gia');
  const eligible = session.eligible_member_ids.length;
  const presentCount = joined.length + late.length;
  const pct = eligible > 0 ? Math.round((presentCount / eligible) * 100) : 0;
  const bar = buildProgressBar(pct);

  const checkedIds = new Set(attended.map(a => a.user_id));
  const absentIds  = session.eligible_member_ids.filter(id => !checkedIds.has(id));

  const startedAt = session.created_at ?? session.started_at;
  const startTs   = Math.floor(new Date(startedAt).getTime() / 1000);

  const roleDisplay = session.allowed_role_id
    ? `<@&${session.allowed_role_id}>`
    : (session.role_name ?? 'Tất cả');

  const descLines = [
    `${bar} ${pct}% (${presentCount}/${eligible})`,
    ` Role: ${roleDisplay} · ${eligible} thành viên`,
    ` Bắt đầu: <t:${startTs}:f>`,
  ];

  if (session.auto_close_at) {
    const ts = Math.floor(new Date(session.auto_close_at).getTime() / 1000);
    descLines.push(` Tự đóng: <t:${ts}:f>`);
  }

  const embed = new EmbedBuilder()
    .setAuthor({ name: `🏩 ${FOOTER_DEFAULT}` })
    .setTitle(`Điểm Danh: ${session.session_name}`)
    .setColor(COLOR_ACTIVE)
    .setDescription(descLines.join('\n'))
    .setTimestamp();

  if (guild) {
    const iconURL = guild.iconURL({ dynamic: true });
    if (iconURL) embed.setThumbnail(iconURL);
  }

  // BUG-6 FIX: đổi a.display_name → a.username để khớp với schema bảng attendances
  if (joined.length > 0)
    chunkLines(joined.map((a, i) => `\`${String(i + 1).padStart(2)}.\` **${a.username}**`))
      .forEach((chunk, i) => embed.addFields({
        name: i === 0 ? `✅ Tham Gia — ${joined.length}` : '\u200b',
        value: chunk, inline: true,
      }));

  if (late.length > 0)
    chunkLines(late.map((a, i) => `\`${String(i + 1).padStart(2)}.\` ${a.username}`))
      .forEach((chunk, i) => embed.addFields({
        name: i === 0 ? `⏰ Đến Trễ — ${late.length}` : '\u200b',
        value: chunk, inline: true,
      }));

  if (declined.length > 0)
    chunkLines(declined.map((a, i) => `\`${String(i + 1).padStart(2)}.\` ~~${a.username}~~`))
      .forEach((chunk, i) => embed.addFields({
        name: i === 0 ? `❌ Vắng Mặt — ${declined.length}` : '\u200b',
        value: chunk, inline: true,
      }));

  if (absentIds.length > 0) {
    const MAX = 25;
    const mentions = absentIds.slice(0, MAX).map(id => `<@${id}>`);
    const extra = absentIds.length > MAX ? ` *(+${absentIds.length - MAX} nữa)*` : '';
    embed.addFields({
      name: `⏳ Chưa Điểm Danh (${absentIds.length})`,
      value: mentions.join(' ') + extra,
      inline: false,
    });
  }

  embed.setFooter({ text: `${FOOTER_DEFAULT} · Phiên đang mở — bấm nút để điểm danh` });
  return embed;
}

// ─── Summary Embed (đã đóng) ──────────────────────────────────────────────────
function buildSummaryEmbed(session, attended) {
  const joined   = attended.filter(a => a.status === 'tham_gia');
  const late     = attended.filter(a => a.status === 'tre');
  const declined = attended.filter(a => a.status === 'khong_tham_gia');
  const eligible = session.eligible_member_ids.length;
  const presentCount = joined.length + late.length;
  const pct = eligible > 0 ? Math.round((presentCount / eligible) * 100) : 0;
  const bar = buildProgressBar(pct);

  const startedAt = session.created_at ?? session.started_at;
  const startTs   = Math.floor(new Date(startedAt).getTime() / 1000);
  const endTs     = session.ended_at ? Math.floor(new Date(session.ended_at).getTime() / 1000) : null;

  let durationStr = '';
  if (endTs) {
    const dur = formatDuration(endTs - startTs);
    if (dur) durationStr = ` · ⏱ ${dur}`;
  }

  const descLines = [
    `${pctEmoji(pct)} **${pct}%** — ${pctLabel(pct)} · \`${bar}\``,
    `> ✅ \`${joined.length}\`  ⏰ \`${late.length}\`  ❌ \`${declined.length}\`  👥 \`${eligible} thành viên\``,
    '',
    `🕐 <t:${startTs}:f>${endTs ? `  →  <t:${endTs}:f>${durationStr}` : ''}`,
  ];

  const embed = new EmbedBuilder()
    .setAuthor(AUTHOR_DEFAULT)
    .setTitle(`📊 Tổng Kết: ${session.session_name}`)
    .setColor(pctColor(pct))
    .setDescription(descLines.join('\n'))
    .setTimestamp();

  // BUG-6 FIX: đổi a.display_name → a.username
  const joinedLines = joined.map((a, i) => `\`${String(i + 1).padStart(2)}.\` **${a.username}**`);
  const lateLines   = late.map((a, i)   => `\`${String(i + 1).padStart(2)}.\` ${a.username}`);
  const decLines    = declined.map((a, i) => `\`${String(i + 1).padStart(2)}.\` ~~${a.username}~~`);

  if (joinedLines.length > 0)
    chunkLines(joinedLines).forEach((chunk, i) =>
      embed.addFields({ name: i === 0 ? `✅ Tham Gia — ${joined.length}` : '\u200b', value: chunk, inline: true }));
  else
    embed.addFields({ name: '✅ Tham Gia — 0', value: '—', inline: true });

  if (lateLines.length > 0)
    chunkLines(lateLines).forEach((chunk, i) =>
      embed.addFields({ name: i === 0 ? `⏰ Đến Trễ — ${late.length}` : '\u200b', value: chunk, inline: true }));

  if (decLines.length > 0)
    chunkLines(decLines).forEach((chunk, i) =>
      embed.addFields({ name: i === 0 ? `❌ Vắng Mặt — ${declined.length}` : '\u200b', value: chunk, inline: true }));
  else
    embed.addFields({ name: '❌ Vắng Mặt — 0', value: '—', inline: true });

  embed.setFooter({ text: `${FOOTER_DEFAULT} · Role: ${session.role_name}` });
  return embed;
}

// ─── History Embed ────────────────────────────────────────────────────────────
function buildHistoryEmbed(history) {
  if (history.length === 0) {
    return new EmbedBuilder()
      .setAuthor(AUTHOR_DEFAULT)
      .setTitle('📚 Lịch Sử Điểm Danh')
      .setColor(COLOR_GREY)
      .setDescription('> Chưa có phiên nào được kết thúc.')
      .setFooter({ text: FOOTER_DEFAULT });
  }

  const lines = history.map((s, i) => {
    const startedAt = s.created_at ?? s.started_at;
    const ts = Math.floor(new Date(startedAt).getTime() / 1000);
    const eligible = (s.eligible_member_ids ?? []).length;
    return [
      `\`${String(i + 1).padStart(2)}.\` **${s.session_name}** — <t:${ts}:d>`,
      `> \`ID: ${s.id}\`  ·  ${eligible} thành viên`,
    ].join('\n');
  });

  return new EmbedBuilder()
    .setAuthor(AUTHOR_DEFAULT)
    .setTitle(`📚 Lịch Sử Điểm Danh — ${history.length} phiên gần nhất`)
    .setColor(COLOR_GOLD)
    .setDescription(lines.join('\n'))
    .setFooter({ text: `${FOOTER_DEFAULT} · Dùng ID với /thong_ke_phien và /sua_diemdanh` })
    .setTimestamp();
}

// ─── Member Embed ─────────────────────────────────────────────────────────────
function buildMemberEmbed(member, stats, badge, pct, bar) {
  const streakBar = stats.current_streak > 0
    ? '🔥'.repeat(Math.min(stats.current_streak, 10)) + (stats.current_streak > 10 ? ` x${stats.current_streak}` : '')
    : '*(không có streak)*';

  return new EmbedBuilder()
    .setAuthor(AUTHOR_DEFAULT)
    .setTitle(`📋 ${member.displayName}`)
    .setColor(pctColor(pct))
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setDescription([
      `${pctEmoji(pct)} **${pct}%** — ${pctLabel(pct)}`,
      `\`${bar}\``,
      `> 📅 ${stats.total_joined} tham gia · ${stats.total_sessions} tổng phiên`,
    ].join('\n'))
    .addFields(
      { name: '🔥 Streak Hiện Tại', value: streakBar, inline: false },
      { name: '🏆 Streak Tốt Nhất', value: `**${stats.best_streak ?? 0}** phiên`, inline: true },
      { name: '🏅 Huy Hiệu', value: badge || '*(chưa có)*', inline: true },
    )
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();
}

// ─── Config Embed ─────────────────────────────────────────────────────────────
function buildConfigEmbed(cfg) {
  return new EmbedBuilder()
    .setAuthor(AUTHOR_DEFAULT)
    .setTitle('⚙️ Cấu Hình Server')
    .setColor(COLOR_ACTIVE)
    .addFields(
      { name: '👥 Role Điểm Danh', value: cfg.allowed_role_id ? `<@&${cfg.allowed_role_id}>` : '*(tất cả)*', inline: true },
      { name: '🔑 Role Admin Bot', value: cfg.admin_role_id   ? `<@&${cfg.admin_role_id}>`   : '*(chưa đặt)*', inline: true },
      { name: '⚔️ Role Phái', value: (cfg.phai_role_ids ?? []).length > 0
        ? cfg.phai_role_ids.map(id => `<@&${id}>`).join(' ')
        : '*(chưa cấu hình)*', inline: false },
    )
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();
}

module.exports = {
  pctColor, pctEmoji, pctLabel, chunkLines, formatDuration,
  FOOTER_DEFAULT, AUTHOR_DEFAULT,
  buildAttendanceButtons,
  buildSessionEmbed,
  buildSummaryEmbed,
  buildHistoryEmbed,
  buildMemberEmbed,
  buildConfigEmbed,
};
