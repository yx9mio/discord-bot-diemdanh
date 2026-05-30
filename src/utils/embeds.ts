import { Colors, EmbedBuilder, Guild, Role } from 'discord.js';
import { Session, HistorySession } from '../types.js';
import { buildProgressBar } from './progress.js';

function fmtList(values: string[]): string {
  return values.length ? values.join('\n') : '_Chưa có ai_';
}

export function displayColor(joined: number, declined: number): number {
  if (joined === 0 && declined === 0) return Colors.Blurple;
  if (joined >= declined) return Colors.Green;
  return Colors.Orange;
}

export async function buildDisplayEmbed(guild: Guild, session: Session, closed = false): Promise<EmbedBuilder> {
  const attendees = Object.values(session.attendees);
  const joined = attendees.filter((x) => x.status === 'tham_gia');
  const declined = attendees.filter((x) => x.status === 'khong_tham_gia');
  const role = session.role_id ? await guild.roles.fetch(session.role_id).catch(() => null) : null;
  const eligibleCount = role ? role.members.size : 0;
  const progress = buildProgressBar(joined.length, eligibleCount || Math.max(joined.length + declined.length, 1));
  const prefix = closed ? '🏆 [ĐÃ KẾT THÚC]' : '📋 Điểm Danh Bang Chiến';

  return new EmbedBuilder()
    .setTitle(`${prefix}: ${session.session_name}`)
    .setColor(displayColor(joined.length, declined.length))
    .setDescription([
      `👥 Role được điểm danh: **${session.role_name}**`,
      `📈 Tỷ lệ tham gia: ${progress}`,
      session.end_time ? `⏳ Tự động kết thúc: <t:${Math.floor(new Date(session.end_time).getTime() / 1000)}:R>` : '⏳ Không đặt tự động kết thúc',
    ].join('\n'))
    .addFields(
      {
        name: `✅ Tham Gia — ${joined.length}`,
        value: fmtList(joined.map((d, i) => `\`${String(i + 1).padStart(2)}.\` ${d.name} *(lúc ${d.time})*`)),
        inline: false,
      },
      {
        name: `❌ Không Tham Gia — ${declined.length}`,
        value: fmtList(declined.map((d, i) => `\`${String(i + 1).padStart(2)}.\` ${d.name} *(lúc ${d.time})*`)),
        inline: false,
      },
    )
    .setFooter({ text: `Tổng đã điểm danh: ${attendees.length} • Bắt đầu: ${session.start_time}` })
    .setTimestamp();
}

export function buildSummaryEmbed(session: Session): EmbedBuilder {
  const attendees = Object.values(session.attendees);
  const joined = attendees.filter((x) => x.status === 'tham_gia').length;
  const declined = attendees.filter((x) => x.status === 'khong_tham_gia').length;
  return new EmbedBuilder()
    .setTitle(`🏁 Kết Thúc Điểm Danh: ${session.session_name}`)
    .setColor(Colors.Green)
    .addFields(
      { name: '✅ Tham Gia', value: String(joined), inline: true },
      { name: '❌ Không Tham Gia', value: String(declined), inline: true },
      { name: '📊 Tổng Cộng', value: String(attendees.length), inline: true },
    )
    .setTimestamp();
}

export function buildHistoryEmbed(items: HistorySession[]): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('📚 Lịch Sử Điểm Danh')
    .setColor(Colors.Blue)
    .setDescription(items.length ? items.slice(0, 10).map((s, i) => {
      const total = s.total_tham_gia + s.total_khong_tham_gia;
      return `**${i + 1}. ${s.session_name}**\nBắt đầu: ${s.start_time}\nKết thúc: ${s.end_time}\nRole: ${s.role_name}\nTổng: ${total} (${s.total_tham_gia} tham gia / ${s.total_khong_tham_gia} không tham gia)`;
    }).join('\n\n') : 'Chưa có lịch sử phiên nào.')
    .setTimestamp();
}

export function buildStatsEmbed(title: string, lines: string[]): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(title)
    .setColor(Colors.Gold)
    .setDescription(lines.length ? lines.join('\n') : 'Chưa đủ dữ liệu thống kê.')
    .setTimestamp();
}

export function buildConfigEmbed(role: Role | null, roleName: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('⚙️ Cấu Hình Điểm Danh')
    .setColor(Colors.Blurple)
    .setDescription(`Role được điểm danh hiện tại: **${role?.name ?? roleName}**`)
    .setTimestamp();
}
