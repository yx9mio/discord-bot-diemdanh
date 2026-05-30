import { Colors, EmbedBuilder } from 'discord.js';
import { HistorySession, Session } from './types.js';

function progressBar(current: number, total: number, size = 12): string {
  if (total <= 0) return '░'.repeat(size);
  const filled = Math.round((current / total) * size);
  return '█'.repeat(filled) + '░'.repeat(size - filled);
}

export function buildAttendanceEmbed(session: Session, closed = false): EmbedBuilder {
  const attendees = Object.values(session.attendees);
  const thamGia = attendees.filter((a) => a.status === 'tham_gia');
  const khongThamGia = attendees.filter((a) => a.status === 'khong_tham_gia');
  const total = attendees.length;
  const joinRate = total > 0 ? Math.round((thamGia.length / total) * 100) : 0;

  const topAvatar = attendees[0]?.avatar ?? null;
  const tgText = thamGia.length
    ? thamGia.map((d, i) => `\`${String(i + 1).padStart(2)}.\` ${d.name} • ${d.time}`).join('\n')
    : '_Chưa có ai_';
  const ktgText = khongThamGia.length
    ? khongThamGia.map((d, i) => `\`${String(i + 1).padStart(2)}.\` ${d.name} • ${d.time}`).join('\n')
    : '_Chưa có ai_';

  return new EmbedBuilder()
    .setTitle(`${closed ? '🏁 Phiên Đã Kết Thúc' : '⚔️ Điểm Danh Bang Chiến'} • ${session.session_name}`)
    .setDescription([
      `**Role được điểm danh:** ${session.allowed_role_name}`,
      `**Bắt đầu:** ${session.start_time}`,
      session.auto_close_at ? `**Tự đóng lúc:** ${session.auto_close_at}` : '**Tự đóng:** Không',
      '',
      `**Tỷ lệ tham gia:** ${joinRate}%`,
      `\`${progressBar(thamGia.length, Math.max(total, 1))}\``,
    ].join('\n'))
    .setColor(closed ? Colors.Green : Colors.Blurple)
    .setThumbnail(topAvatar)
    .addFields(
      { name: `✅ Tham Gia — ${thamGia.length}`, value: tgText, inline: false },
      { name: `❌ Không Tham Gia — ${khongThamGia.length}`, value: ktgText, inline: false },
      {
        name: '📊 Tổng quan',
        value: [`Tổng điểm danh: **${total}**`, `Reminder: **${session.reminder_minutes ?? 0} phút**`, `Ping role: **${session.ping_role_id ? 'Có' : 'Không'}**`].join('\n'),
        inline: false,
      }
    )
    .setFooter({ text: closed ? 'Phiên đã được lưu vào lịch sử' : 'Danh sách tự động cập nhật real-time' })
    .setTimestamp();
}

export function buildSummaryEmbed(history: HistorySession): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`📦 Tổng Kết • ${history.session_name}`)
    .setColor(Colors.Green)
    .addFields(
      { name: '✅ Tham Gia', value: String(history.total_tham_gia), inline: true },
      { name: '❌ Không Tham Gia', value: String(history.total_khong_tham_gia), inline: true },
      { name: '📊 Tổng Cộng', value: String(history.total_attendees), inline: true },
      { name: '🕒 Bắt đầu', value: history.start_time, inline: true },
      { name: '🛑 Kết thúc', value: history.ended_at, inline: true },
      { name: '👥 Role', value: history.allowed_role_name, inline: true }
    )
    .setTimestamp();
}

export function buildHistoryEmbed(items: HistorySession[]): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('🗂️ Lịch Sử Điểm Danh')
    .setColor(Colors.Gold)
    .setDescription(
      items.length
        ? items
            .slice(0, 10)
            .map((x, i) => `${i + 1}. **${x.session_name}** — ${x.ended_at} • ✅ ${x.total_tham_gia} / ❌ ${x.total_khong_tham_gia}`)
            .join('\n')
        : 'Chưa có lịch sử nào.'
    )
    .setTimestamp();
}

export function buildStatsEmbed(rows: { name: string; tham_gia_count: number; khong_tham_gia_count: number; total_count: number }[]): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('🏆 Thống Kê Thành Viên')
    .setColor(Colors.Fuchsia)
    .setDescription(
      rows.length
        ? rows
            .slice(0, 10)
            .map((r, i) => `${i + 1}. **${r.name}** — ✅ ${r.tham_gia_count} • ❌ ${r.khong_tham_gia_count} • Tổng ${r.total_count}`)
            .join('\n')
        : 'Chưa có dữ liệu thống kê.'
    )
    .setTimestamp();
}
