// commands/thongkephien.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db.js');
const { buildProgressBar, pctColor, pctEmoji, FOOTER_DEFAULT, AUTHOR_DEFAULT } = require('../utils/embeds.js');

const data = new SlashCommandBuilder()
  .setName('thong_ke_phien')
  .setDescription('Xem chi tiết một phiên đã kết thúc')
  .addStringOption(o => o.setName('session_id').setDescription('ID phiên (lấy từ /lich_su)').setRequired(true));

async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const guild     = interaction.guild;
  const sessionId = interaction.options.getString('session_id');
  const session   = await db.getSessionById(sessionId, guild.id);

  if (!session) {
    return interaction.editReply({ content: '⚠️ Không tìm thấy phiên này. Kiểm tra lại ID từ `/lich_su`.' });
  }

  const attended = await db.getAttendances(session.id);
  const joined   = attended.filter(a => ['tham_gia', 'tre'].includes(a.status));
  const eligible = session.eligible_member_ids.length;
  const pct      = eligible > 0 ? Math.round((joined.length / eligible) * 100) : 0;
  const bar      = buildProgressBar(pct);
  const startTs  = Math.floor(new Date(session.started_at).getTime() / 1000);
  const endTs    = session.ended_at ? Math.floor(new Date(session.ended_at).getTime() / 1000) : null;

  const embed = new EmbedBuilder()
    .setAuthor(AUTHOR_DEFAULT)
    .setTitle(`📊 Chi Tiết Phiên: ${session.session_name}`)
    .setColor(pctColor(pct))
    .setDescription([
      `${pctEmoji(pct)} \`${bar}\` **${pct}%** (${joined.length}/${eligible})`,
      `🕐 Bắt đầu: <t:${startTs}:f>`,
      endTs ? `🔒 Kết thúc: <t:${endTs}:f>` : '',
      `👥 Role: **${session.role_name}**`,
      `🪪 ID: \`${session.id}\``,
    ].filter(Boolean).join('\n'))
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

module.exports = { data, execute };
