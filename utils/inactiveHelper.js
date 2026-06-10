// utils/inactiveHelper.js
// Logic tính + build embed danh sách thành viên không hoạt động.
'use strict';
const { EmbedBuilder } = require('discord.js');
const memberService = require('../services/memberService.js');
const { FOOTER_DEFAULT } = require('./embeds.js');

/**
 * Tính danh sách inactive từ member_stats.
 *
 * Điều kiện lọc:
 *   1. total_sessions >= soPhienToiThieu   — đủ dữ liệu để đánh giá
 *   2. (total_absent / total_sessions) * 100 >= nguong  — tỷ lệ vắng cao
 *
 * Sắp xếp: tỷ lệ vắng giảm dần, rồi tới total_absent giảm dần.
 *
 * @param {object} opts
 * @param {import('discord.js').Guild} opts.guild
 * @param {number} opts.nguong          - % vắng tối thiểu (default 50)
 * @param {number} opts.soLuong         - số dòng hiển thị (default 20)
 * @param {number} opts.soPhienToiThieu - tối thiểu phiên để tính (default 3)
 * @returns {{ embed: EmbedBuilder, total: number }}
 */
async function buildInactiveEmbed({ guild, nguong = 50, soLuong = 20, soPhienToiThieu = 3 }) {
  const allStats = await memberService.getAllMemberStats(guild.id);

  // Lọc + tính tỷ lệ
  const rows = allStats
    .filter(s => {
      const sessions = s.total_sessions ?? 0;
      if (sessions < soPhienToiThieu) return false;
      const absent = s.total_absent ?? 0;
      const rate = (absent / sessions) * 100;
      return rate >= nguong;
    })
    .map(s => {
      const sessions = s.total_sessions ?? 0;
      const absent   = s.total_absent   ?? 0;
      const rate     = Math.round((absent / sessions) * 100);
      return { ...s, absent, sessions, rate };
    })
    .sort((a, b) => b.rate - a.rate || b.absent - a.absent)
    .slice(0, soLuong);

  const embed = new EmbedBuilder()
    .setTitle('🟥 Thành Viên Không Hoạt Động')
    .setColor(0xa12c7b)
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();

  if (!rows.length) {
    embed.setDescription(
      `✅ Không có thành viên nào có tỷ lệ vắng ≥ **${nguong}%**` +
      ` (với ≥ ${soPhienToiThieu} phiên tham gia).`
    );
    return { embed, total: 0 };
  }

  const lines = rows.map((s, i) => {
    const tag = `<@${s.user_id}>`;
    const bar = buildBar(s.rate);
    return `\`${String(i + 1).padStart(2, ' ')}\` ${tag}  ${bar} **${s.rate}%** vắng  *(${s.absent}/${s.sessions} phiên)*`;
  });

  embed.setDescription(lines.join('\n'));
  embed.addFields({
    name: '📊 Bộ lọc',
    value: [
      `Vắng ≥ **${nguong}%**`,
      `Số phiên tối thiểu: **${soPhienToiThieu}**`,
      `Hiển thị: **${rows.length}** / **${allStats.filter(s => (s.total_sessions ?? 0) >= soPhienToiThieu).length}** thành viên đủ điều kiện`,
    ].join(' · '),
    inline: false,
  });

  return { embed, total: rows.length };
}

/** Mini progress bar 10 bước */
function buildBar(rate) {
  const filled = Math.round(rate / 10);
  return '\u2588'.repeat(filled) + '\u2591'.repeat(10 - filled);
}

module.exports = { buildInactiveEmbed };
