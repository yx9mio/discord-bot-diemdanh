import { Colors, EmbedBuilder, Guild } from 'discord.js';
import { HistorySession, Session } from '../types.js';
import { GuildConfig, Role } from 'discord.js';
import { buildProgressBar } from './progress.js';

// ─── Display Embed (live session) ───────────────────────────────────────────

export async function buildDisplayEmbed(
  guild: Guild,
  session: Session,
  ended = false,
): Promise<EmbedBuilder> {
  const attendees = Object.values(session.attendees);
  const joined = attendees.filter((x) => x.status === 'tham_gia');
  const declined = attendees.filter((x) => x.status === 'khong_tham_gia');
  const eligible = session.eligible_member_ids.length;

  const pct = eligible > 0 ? Math.round((joined.length / eligible) * 100) : 0;
  const bar = buildProgressBar(pct);

  const embed = new EmbedBuilder()
    .setTitle(ended ? `🔒 Đã Kết Thúc: ${session.session_name}` : `⚔️ Điểm Danh: ${session.session_name}`)
    .setColor(ended ? Colors.Grey : Colors.Gold)
    .setTimestamp();

  // Header stats
  const statsLines = [
    `📈 Tỷ lệ: \`${bar}\` **${pct}%** (${joined.length}/${eligible})`,
    `✅ Tham gia: **${joined.length}** | ❌ Không: **${declined.length}**`,
  ];

  // Countdown (only when session has end_time and not ended)
  if (!ended && session.end_time) {
    const endUnix = Math.floor(new Date(session.end_time).getTime() / 1000);
    statsLines.push(`⏰ Kết thúc: <t:${endUnix}:R>`);
  }

  embed.setDescription(statsLines.join('\n'));

  // Attendees list — tham_gia
  if (joined.length > 0) {
    const lines = joined.map((x, i) => `\`${String(i + 1).padStart(2)}.\` **${x.name}** (${x.time})`);
    // chunk if > 1024 chars
    const chunks = chunkLines(lines, 950);
    chunks.forEach((chunk, i) => {
      embed.addFields({
        name: i === 0 ? `✅ Tham Gia (${joined.length})` : '\u200b',
        value: chunk,
        inline: false,
      });
    });
  }

  // Declined list
  if (declined.length > 0) {
    const lines = declined.map((x, i) => `\`${String(i + 1).padStart(2)}.\` ${x.name}`);
    const chunks = chunkLines(lines, 950);
    chunks.forEach((chunk, i) => {
      embed.addFields({
        name: i === 0 ? `❌ Không Tham Gia (${declined.length})` : '\u200b',
        value: chunk,
        inline: false,
      });
    });
  }

  // Absent list (only while session is open)
  if (!ended && eligible > 0) {
    const checkedIds = new Set(Object.keys(session.attendees));
    const absentIds = session.eligible_member_ids.filter((id) => !checkedIds.has(id));
    if (absentIds.length > 0) {
      await guild.members.fetch().catch(() => null);
      const MAX_SHOW = 20;
      const names = absentIds.slice(0, MAX_SHOW).map((id) => {
        const m = guild.members.cache.get(id);
        return m ? m.displayName : `<@${id}>`;
      });
      const extra = absentIds.length > MAX_SHOW ? `\n*(+${absentIds.length - MAX_SHOW} người nữa)*` : '';
      embed.addFields({
        name: `⏳ Chưa Điểm Danh (${absentIds.length})`,
        value: names.join(', ') + extra,
        inline: false,
      });
    }
  }

  embed.setFooter({ text: `Role: ${session.role_name} • Bắt đầu: ${session.start_time}` });
  return embed;
}

// ─── Summary Embed (after session ends) ─────────────────────────────────────

export function buildSummaryEmbed(session: Session): EmbedBuilder {
  const attendees = Object.values(session.attendees);
  const joined = attendees.filter((x) => x.status === 'tham_gia');
  const declined = attendees.filter((x) => x.status === 'khong_tham_gia');
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

// ─── History Embed ───────────────────────────────────────────────────────────

export function buildHistoryEmbed(history: HistorySession[]): EmbedBuilder {
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

// ─── Stats Embed ─────────────────────────────────────────────────────────────

export function buildStatsEmbed(title: string, lines: string[]): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(title)
    .setColor(Colors.Purple)
    .setDescription(lines.length > 0 ? lines.join('\n') : 'Chưa có dữ liệu.')
    .setTimestamp();
}

// ─── Config Embed ─────────────────────────────────────────────────────────────

export function buildConfigEmbed(
  cfg: { allowed_role_id: string | null; allowed_role_name: string; admin_role_id: string | null; admin_role_name: string },
  attendanceRole: { toString(): string } | null,
  adminRole: { toString(): string } | null,
): EmbedBuilder {
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function chunkLines(lines: string[], maxLen: number): string[] {
  const chunks: string[] = [];
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
