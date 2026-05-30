import { Colors, EmbedBuilder, Guild, Role } from 'discord.js';
import { Session, HistorySession, GuildConfig } from '../types.js';
import { buildProgressBar } from './progress.js';

function fmtList(values: string[]): string {
  return values.length ? values.join('\n') : '_Chưa có ai_';
}

export function displayColor(joined: number, declined: number): number {
  if (joined === 0 && declined === 0) return Colors.Blurple;
  if (joined >= declined) return Colors.Green;
  return Colors.Orange;
}

export async function buildDisplayEmbed(
  guild: Guild,
  session: Session,
  closed = false,
): Promise<EmbedBuilder> {
  const attendees = Object.values(session.attendees);
  const joined = attendees.filter((x) => x.status === 'tham_gia');
  const declined = attendees.filter((x) => x.status === 'khong_tham_gia');

  const role = session.role_id
    ? await guild.roles.fetch(session.role_id).catch(() => null)
    : null;
  const eligibleCount = role ? role.members.size : session.eligible_member_ids.length;
  const denominator = Math.max(eligibleCount, joined.length + declined.length, 1);
  const pct = Math.round((joined.length / denominator) * 100);
  const progress = buildProgressBar(joined.length, denominator);

  // Members with role who haven't checked in
  const checkedIds = new Set(attendees.map((a) => a.user_id));
  const absentIds = (role
    ? [...role.members.keys()]
    : session.eligible_member_ids
  ).filter((id) => !checkedIds.has(id));

  const absentNames: string[] = [];
  for (const id of absentIds.slice(0, 20)) {
    const member = guild.members.cache.get(id);
    absentNames.push(member ? member.displayName : `<@${id}>`);
  }
  const absentMore = absentIds.length > 20 ? ` _(+${absentIds.length - 20} người nữa)_` : '';

  const prefix = closed ? '🏆 [ĐÃ KẾT THÚC]' : '📋 Điểm Danh Bang Chiến';

  const descLines = [
    `👥 Role: **${session.role_name}** • Tổng eligible: **${eligibleCount}**`,
    `📈 Tỷ lệ tham gia: ${progress} **${pct}%** (${joined.length}/${denominator})`,
  ];

  if (session.end_time && !closed) {
    const ts = Math.floor(new Date(session.end_time).getTime() / 1000);
    descLines.push(`⏰ Kết thúc: <t:${ts}:R> (<t:${ts}:t>)`);
  } else if (!closed) {
    descLines.push('⏳ Không đặt tự động kết thúc');
  }

  const embed = new EmbedBuilder()
    .setTitle(`${prefix}: ${session.session_name}`)
    .setColor(displayColor(joined.length, declined.length))
    .setDescription(descLines.join('\n'))
    .addFields(
      {
        name: `✅ Tham Gia — ${joined.length}`,
        value: fmtList(
          joined.map((d, i) => `\`${String(i + 1).padStart(2)}.\` ${d.name} *(${d.time})*`),
        ),
        inline: false,
      },
      {
        name: `❌ Không Tham Gia — ${declined.length}`,
        value: fmtList(
          declined.map((d, i) => `\`${String(i + 1).padStart(2)}.\` ${d.name} *(${d.time})*`),
        ),
        inline: false,
      },
    );

  if (!closed && absentIds.length > 0) {
    embed.addFields({
      name: `⏳ Chưa Điểm Danh — ${absentIds.length}`,
      value: absentNames.join(', ') + absentMore,
      inline: false,
    });
  }

  embed
    .setFooter({ text: `Đã điểm danh: ${attendees.length} • Bắt đầu: ${session.start_time}` })
    .setTimestamp();

  return embed;
}

export function buildSummaryEmbed(session: Session): EmbedBuilder {
  const attendees = Object.values(session.attendees);
  const joined = attendees.filter((x) => x.status === 'tham_gia').length;
  const declined = attendees.filter((x) => x.status === 'khong_tham_gia').length;
  const eligible = session.eligible_member_ids.length || attendees.length;
  const pct = eligible > 0 ? Math.round((joined / eligible) * 100) : 0;
  return new EmbedBuilder()
    .setTitle(`🏁 Kết Thúc Điểm Danh: ${session.session_name}`)
    .setColor(Colors.Green)
    .addFields(
      { name: '✅ Tham Gia', value: String(joined), inline: true },
      { name: '❌ Không Tham Gia', value: String(declined), inline: true },
      { name: '📊 Tổng / Eligible', value: `${attendees.length} / ${eligible} (${pct}%)`, inline: true },
    )
    .setTimestamp();
}

export function buildHistoryEmbed(items: HistorySession[]): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('📚 Lịch Sử Điểm Danh')
    .setColor(Colors.Blue)
    .setDescription(
      items.length
        ? items
            .slice(-10)
            .reverse()
            .map((s, i) => {
              const total = s.total_tham_gia + s.total_khong_tham_gia;
              return (
                `**${i + 1}. ${s.session_name}**\n` +
                `Bắt đầu: ${s.start_time} • Kết thúc: ${s.end_time}\n` +
                `Role: ${s.role_name} • Tổng: ${total} (${s.total_tham_gia}✅ / ${s.total_khong_tham_gia}❌)`
              );
            })
            .join('\n\n')
        : 'Chưa có lịch sử phiên nào.',
    )
    .setTimestamp();
}

export function buildStatsEmbed(title: string, lines: string[]): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(title)
    .setColor(Colors.Gold)
    .setDescription(lines.length ? lines.join('\n') : 'Chưa đủ dữ liệu thống kê.')
    .setTimestamp();
}

export function buildConfigEmbed(
  cfg: GuildConfig,
  attendanceRole: Role | null,
  adminRole: Role | null,
): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('⚙️ Cấu Hình Bot Điểm Danh')
    .setColor(Colors.Blurple)
    .addFields(
      {
        name: '📋 Role Điểm Danh',
        value: attendanceRole
          ? `${attendanceRole} (${attendanceRole.name})`
          : `**${cfg.allowed_role_name}** _(chưa tìm thấy)_`,
        inline: true,
      },
      {
        name: '🛡️ Role Admin Bot',
        value: adminRole
          ? `${adminRole} (${adminRole.name})`
          : `**${cfg.admin_role_name}** _(chưa tìm thấy)_`,
        inline: true,
      },
    )
    .setFooter({ text: 'Người có ManageGuild luôn có quyền admin bot' })
    .setTimestamp();
}
