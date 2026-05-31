// utils/embeds.js — Tất cả embed builders & button builders
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { buildProgressBar } = require('./progress.js');

// ─── Constants ─────────────────────────────────────────────────
const COLOR_HIGH   = 0x57F287;
const COLOR_MID    = 0xFEE75C;
const COLOR_LOW    = 0xED4245;
const COLOR_ACTIVE = 0x5865F2;
const COLOR_GREY   = 0x99AAB5;
const COLOR_GOLD   = 0xD4AF37;

const FOOTER_DEFAULT = 'Quản Gia';
const AUTHOR_DEFAULT = { name: '🏩 Quản Gia' };

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

function buildAttendanceButtons(disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('attend_yes').setLabel('✅ Tham Gia').setStyle(ButtonStyle.Success).setDisabled(disabled),
    new ButtonBuilder().setCustomId('attend_late').setLabel('⏰ Đến Trễ').setStyle(ButtonStyle.Primary).setDisabled(disabled),
    new ButtonBuilder().setCustomId('attend_no').setLabel('❌ Vắng Mặt').setStyle(ButtonStyle.Danger).setDisabled(disabled),
    new ButtonBuilder().setCustomId('attend_view').setLabel('📋 Xem DS').setStyle(ButtonStyle.Secondary).setDisabled(false),
  );
}

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

  let desc = `${pctEmoji(pct)} \`${bar}\` **${pct}%** (${presentCount}/${eligible})\n`;
  desc += `👥 Role: **${session.role_name}** · ${eligible} thành viên\n`;
  desc += `🕐 Bắt đầu: <t:${Math.floor(new Date(session.started_at).getTime() / 1000)}:f>`;
  if (session.auto_close_at) {
    const ts = Math.floor(new Date(session.auto_close_at).getTime() / 1000);
    desc += `\n🔒 Tự đóng: <t:${ts}:R> (<t:${ts}:T>)`;
  }

  const embed = new EmbedBuilder()
    .setAuthor(AUTHOR_DEFAULT)
    .setTitle(`⚔️ Điểm Danh: ${session.session_name}`)
    .setColor(COLOR_ACTIVE)
    .setDescription(desc)
    .setTimestamp();

  if (guild) {
    const iconURL = guild.iconURL({ dynamic: true });
    if (iconURL) embed.setThumbnail(iconURL);
  }

  if (joined.length > 0)
    chunkLines(joined.map((a, i) => `\`${String(i + 1).padStart(2)}.\` **${a.username}**`))
      .forEach((chunk, i) => embed.addFields({ name: i === 0 ? `✅ Tham Gia (${joined.length})` : '\u200b', value: chunk, inline: true }));
  if (late.length > 0)
    chunkLines(late.map((a, i) => `\`${String(i + 1).padStart(2)}.\` ${a.username}`))
      .forEach((chunk, i) => embed.addFields({ name: i === 0 ? `⏰ Đến Trễ (${late.length})` : '\u200b', value: chunk, inline: true }));
  if (declined.length > 0)
    chunkLines(declined.map((a, i) => `\`${String(i + 1).padStart(2)}.\` ${a.username}`))
      .forEach((chunk, i) => embed.addFields({ name: i === 0 ? `❌ Vắng Mặt (${declined.length})` : '\u200b', value: chunk, inline: true }));
  if (absentIds.length > 0) {
    const MAX = 25;
    const mentions = absentIds.slice(0, MAX).map(id => `<@${id}>`);
    const extra = absentIds.length > MAX ? ` *(+${absentIds.length - MAX} nữa)*` : '';
    embed.addFields({ name: `⏳ Chưa Điểm Danh (${absentIds.length})`, value: mentions.join(' ') + extra, inline: false });
  }

  embed.setFooter({ text: `${FOOTER_DEFAULT} · Phiên đang mở — bấm nút để điểm danh` });
  return embed;
}

function buildSummaryEmbed(session, attended) {
  const joined   = attended.filter(a => a.status === 'tham_gia');
  const late     = attended.filter(a => a.status === 'tre');
  const declined = attended.filter(a => a.status === 'khong_tham_gia');
  const eligible = session.eligible_member_ids.length;
  const presentCount = joined.length + late.length;
  const pct = eligible > 0 ? Math.round((presentCount / eligible) * 100) : 0;
  const bar = buildProgressBar(pct);

  const startTs = Math.floor(new Date(session.started_at).getTime() / 1000);
  const endTs   = session.ended_at ? Math.floor(new Date(session.ended_at).getTime() / 1000) : null;

  let desc = `${pctEmoji(pct)} \`${bar}\` **${pct}%** (${presentCount}/${eligible})\n`;
  desc += `🕐 Bắt đầu: <t:${startTs}:f>`;
  if (endTs) desc += `\n🔒 Kết thúc: <t:${endTs}:f>`;

  const embed = new EmbedBuilder()
    .setAuthor(AUTHOR_DEFAULT)
    .setTitle(`📊 Tổng Kết: ${session.session_name}`)
    .setColor(pctColor(pct))
    .setDescription(desc)
    .setTimestamp();

  const joinedLines = joined.map((a, i) => `\`${String(i + 1).padStart(2)}.\` **${a.username}**`);
  const lateLines   = late.map((a, i)   => `\`${String(i + 1).padStart(2)}.\` ${a.username}`);
  const decLines    = declined.map((a, i) => `\`${String(i + 1).padStart(2)}.\` ${a.username}`);

  if (joinedLines.length > 0)
    chunkLines(joinedLines).forEach((chunk, i) =>
      embed.addFields({ name: i === 0 ? `✅ Tham Gia (${joined.length})` : '\u200b', value: chunk, inline: true }));
  else
    embed.addFields({ name: '✅ Tham Gia (0)', value: '—', inline: true });

  if (lateLines.length > 0)
    chunkLines(lateLines).forEach((chunk, i) =>
      embed.addFields({ name: i === 0 ? `⏰ Đến Trễ (${late.length})` : '\u200b', value: chunk, inline: true }));

  if (decLines.length > 0)
    chunkLines(decLines).forEach((chunk, i) =>
      embed.addFields({ name: i === 0 ? `❌ Vắng Mặt (${declined.length})` : '\u200b', value: chunk, inline: true }));
  else
    embed.addFields({ name: '❌ Vắng Mặt (0)', value: '—', inline: true });

  embed.setFooter({ text: `${FOOTER_DEFAULT} · Role: ${session.role_name}` });
  return embed;
}

function buildMemberEmbed(member, stats, badge, pct, bar) {
  return new EmbedBuilder()
    .setAuthor(AUTHOR_DEFAULT)
    .setTitle(`📋 Lịch Sử: ${member.displayName}`)
    .setColor(pctColor(pct))
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setDescription([
      `${pctEmoji(pct)} \`${bar}\` **${pct}%** (${stats.total_joined}/${stats.total_sessions})`,
      `🔥 Streak hiện tại: **${stats.current_streak}** phiên`,
      `🏆 Streak tốt nhất: **${stats.best_streak}** phiên`,
      `🏅 Huy hiệu: ${badge || '*(chưa có)*'}`,
    ].join('\n'))
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();
}

function buildStatsEmbed(lines) {
  return new EmbedBuilder()
    .setAuthor(AUTHOR_DEFAULT)
    .setTitle('🏆 Top 10 Thành Viên Chuyên Cần')
    .setColor(COLOR_GOLD)
    .setDescription(lines.length > 0 ? lines.join('\n') : '*(Chưa có dữ liệu)*')
    .setFooter({ text: `${FOOTER_DEFAULT} · Xếp hạng theo số lần tham gia` })
    .setTimestamp();
}

function buildHistoryEmbed(history) {
  if (history.length === 0) {
    return new EmbedBuilder()
      .setAuthor(AUTHOR_DEFAULT)
      .setTitle('📚 Lịch Sử Điểm Danh')
      .setColor(COLOR_GREY)
      .setDescription('*(Chưa có phiên nào kết thúc)*')
      .setFooter({ text: FOOTER_DEFAULT });
  }
  const lines = history.map((s, i) => {
    const ts = Math.floor(new Date(s.started_at).getTime() / 1000);
    return `\`${String(i + 1).padStart(2)}.\` **${s.session_name}** — <t:${ts}:d>\n    \`ID: ${s.id}\``;
  });
  return new EmbedBuilder()
    .setAuthor(AUTHOR_DEFAULT)
    .setTitle(`📚 Lịch Sử Điểm Danh (${history.length} phiên gần nhất)`)
    .setColor(COLOR_GOLD)
    .setDescription(lines.join('\n'))
    .setFooter({ text: `${FOOTER_DEFAULT} · Dùng ID với /thong_ke_phien và /sua_diemdanh` })
    .setTimestamp();
}

function buildConfigEmbed(cfg) {
  return new EmbedBuilder()
    .setAuthor(AUTHOR_DEFAULT)
    .setTitle('⚙️ Cấu Hình')
    .setColor(COLOR_GOLD)
    .addFields(
      { name: '🎯 Role Điểm Danh', value: cfg.allowed_role_id ? `<@&${cfg.allowed_role_id}>` : '*(Tất cả thành viên)*', inline: true },
      { name: '🛡️ Role Admin Bot', value: cfg.admin_role_id ? `<@&${cfg.admin_role_id}>` : '*(Quản trị viên máy chủ)*', inline: true },
    )
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();
}

module.exports = {
  buildAttendanceButtons,
  buildSessionEmbed,
  buildSummaryEmbed,
  buildMemberEmbed,
  buildStatsEmbed,
  buildHistoryEmbed,
  buildConfigEmbed,
  buildProgressBar, // re-export để các file khác không cần import thẳng từ progress.js
  pctColor,
  pctEmoji,
  COLOR_GOLD,
  COLOR_GREY,
  FOOTER_DEFAULT,
  AUTHOR_DEFAULT,
};
