// utils/embeds.js
const { EmbedBuilder, Colors } = require('discord.js');
const { buildProgressBar } = require('./progress.js');

// ─── chunkLines helper ────────────────────────────────────────
function chunkLines(lines, maxLen) {
  const chunks = [];
  let cur = '';
  for (const line of lines) {
    if ((cur + '\n' + line).length > maxLen) {
      if (cur) chunks.push(cur);
      cur = line;
    } else {
      cur = cur ? cur + '\n' + line : line;
    }
  }
  if (cur) chunks.push(cur);
  return chunks;
}

// ─── buildDisplayEmbed ────────────────────────────────────────
async function buildDisplayEmbed(guild, session, ended = false) {
  const attendees = Object.values(session.attendees);
  const joined = attendees.filter(x => x.status === 'tham_gia');
  const declined = attendees.filter(x => x.status === 'khong_tham_gia');
  const eligible = session.eligible_member_ids.length;
  const pct = eligible > 0 ? Math.round((joined.length / eligible) * 100) : 0;
  const bar = buildProgressBar(pct);

  const embed = new EmbedBuilder()
    .setTitle(ended ? `🔒 Đã Kết Thúc: ${session.session_name}` : `⚔️ Điểm Danh: ${session.session_name}`)
    .setColor(ended ? Colors.Grey : Colors.Gold)
    .setTimestamp();

  const statsLines = [
    `📈 Tỷ lệ: \`${bar}\` **${pct}%** (${joined.length}/${eligible})`,
    `✅ Tham gia: **${joined.length}** | ❌ Không: **${declined.length}**`,
  ];

  if (!ended && session.end_time) {
    const endUnix = Math.floor(new Date(session.end_time).getTime() / 1000);
    statsLines.push(`⏰ Kết thúc: <t:${endUnix}:R>`);
  }

  embed.setDescription(statsLines.join('\n'));

  if (joined.length > 0) {
    const lines = joined.map((x, i) => `\`${String(i + 1).padStart(2)}.\` **${x.name}** (${x.time})`);
    chunkLines(lines, 950).forEach((chunk, i) => {
      embed.addFields({ name: i === 0 ? `✅ Tham Gia (${joined.length})` : '\u200b', value: chunk, inline: false });
    });
  }

  if (declined.length > 0) {
    const lines = declined.map((x, i) => `\`${String(i + 1).padStart(2)}.\` ${x.name}`);
    chunkLines(lines, 950).forEach((chunk, i) => {
      embed.addFields({ name: i === 0 ? `❌ Không Tham Gia (${declined.length})` : '\u200b', value: chunk, inline: false });
    });
  }

  if (!ended && eligible > 0) {
    const checkedIds = new Set(Object.keys(session.attendees));
    const absentIds = session.eligible_member_ids.filter(id => !checkedIds.has(id));
    if (absentIds.length > 0) {
      await guild.members.fetch().catch(() => null);
      const MAX_SHOW = 20;
      const names = absentIds.slice(0, MAX_SHOW).map(id => {
        const m = guild.members.cache.get(id);
        return m ? m.displayName : `<@${id}>`;
      });
      const extra = absentIds.length > MAX_SHOW ? `\n*(+${absentIds.length - MAX_SHOW} người nữa)*` : '';
      embed.addFields({ name: `⏳ Chưa Điểm Danh (${absentIds.length})`, value: names.join(', ') + extra, inline: false });
    }
  }

  embed.setFooter({ text: `Role: ${session.role_name} • Bắt đầu: ${session.start_time}` });
  return embed;
}

// ─── buildSummaryEmbed ────────────────────────────────────────
function buildSummaryEmbed(session) {
  const attendees = Object.values(session.attendees);
  const joined = attendees.filter(x => x.status === 'tham_gia');
  const declined = attendees.filter(x => x.status === 'khong_tham_gia');
  const eligible = session.eligible_member_ids.length;
  const pct = eligible > 0 ? Math.round((joined.length / eligible) * 100) : 0;
  const bar = buildProgressBar(pct);

  const joinedList = joined.map((x, i) => `\`${String(i + 1).padStart(2)}.\` ${x.name} (${x.time})`).join('\n') || '—';
  const declinedList = declined.map((x, i) => `\`${String(i + 1).padStart(2)}.\` ${x.name}`).join('\n') || '—';

  return new EmbedBuilder()
    .setTitle(`📊 Tổng Kết: ${session.session_name}`)
    .setColor(Colors.Green)
    .setDescription(`📈 Tỷ lệ: \`${bar}\` **${pct}%** (${joined.length}/${eligible})`)
    .addFields(
      { name: `✅ Tham Gia (${joined.length})`, value: joinedList.slice(0, 1024), inline: false },
      { name: `❌ Không Tham Gia (${declined.length})`, value: declinedList.slice(0, 1024), inline: false },
    )
    .setTimestamp();
}

// ─── buildHistoryEmbed ────────────────────────────────────────
function buildHistoryEmbed(history) {
  if (history.length === 0) {
    return new EmbedBuilder()
      .setTitle('📜 Lịch Sử Điểm Danh')
      .setColor(Colors.Blue)
      .setDescription('Chưa có phiên nào được ghi lại.');
  }
  const recent = history.slice(-10).reverse();
  const lines = recent.map((s, i) => {
    const eligible = s.eligible_count ?? (s.total_tham_gia + s.total_khong_tham_gia);
    const pct = eligible > 0 ? Math.round((s.total_tham_gia / eligible) * 100) : 0;
    return `**${i + 1}. ${s.session_name}**\n✅ ${s.total_tham_gia} | ❌ ${s.total_khong_tham_gia} | 📈 ${pct}% | 🕐 ${s.start_time}`;
  });
  return new EmbedBuilder()
    .setTitle(`📜 Lịch Sử Điểm Danh (${history.length} phiên)`)
    .setColor(Colors.Blue)
    .setDescription(lines.join('\n\n'))
    .setTimestamp();
}

// ─── buildStatsEmbed ─────────────────────────────────────────
function buildStatsEmbed(title, lines) {
  return new EmbedBuilder()
    .setTitle(title)
    .setColor(Colors.Purple)
    .setDescription(lines.length > 0 ? lines.join('\n') : 'Chưa có dữ liệu.')
    .setTimestamp();
}

// ─── buildConfigEmbed ────────────────────────────────────────
function buildConfigEmbed(cfg, attendanceRole, adminRole) {
  return new EmbedBuilder()
    .setTitle('⚙️ Cấu Hình Bot Điểm Danh')
    .setColor(Colors.Blurple)
    .addFields(
      {
        name: '🎯 Role Điểm Danh',
        value: attendanceRole ? `${attendanceRole} (${cfg.allowed_role_name})` : `❌ Chưa cài — tên mặc định: **${cfg.allowed_role_name}**`,
        inline: false,
      },
      {
        name: '🛡️ Role Admin Bot',
        value: adminRole ? `${adminRole} (${cfg.admin_role_name})` : `❌ Chưa cài — tên mặc định: **${cfg.admin_role_name}**`,
        inline: false,
      },
    )
    .setTimestamp();
}

module.exports = { buildDisplayEmbed, buildSummaryEmbed, buildHistoryEmbed, buildStatsEmbed, buildConfigEmbed };
