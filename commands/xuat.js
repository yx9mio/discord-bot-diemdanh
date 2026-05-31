// commands/xuat.js — L5: xuất CSV
const { SlashCommandBuilder, AttachmentBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db.js');
const { laAdmin } = require('../utils/helpers.js');
const { FOOTER_DEFAULT, AUTHOR_DEFAULT } = require('../utils/embeds.js');

const data = new SlashCommandBuilder()
  .setName('xuat_diemdanh')
  .setDescription('Xuất dữ liệu điểm danh ra file CSV')
  .addStringOption(o => o.setName('session_id').setDescription('ID phiên cụ thể (bỏ trống = phiên gần nhất)'));

async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const guild = interaction.guild;
  const cfg   = await db.getConfig(guild.id);

  if (!laAdmin(interaction.member, cfg)) {
    return interaction.editReply({ content: '🔒 Bạn không có quyền thực hiện lệnh này.' });
  }

  let session;
  const sessionId = interaction.options.getString('session_id');

  if (sessionId) {
    session = await db.getSessionById(sessionId, guild.id);
    if (!session) return interaction.editReply({ content: '⚠️ Không tìm thấy phiên này.' });
  } else {
    const history = await db.getSessionHistory(guild.id, 1);
    if (history.length === 0) return interaction.editReply({ content: '⚠️ Chưa có phiên nào kết thúc.' });
    session = history[0];
  }

  const attended = await db.getAttendances(session.id);
  const attendedMap = new Map(attended.map(a => [a.user_id, a]));

  const rows = ['User ID,Username,Trạng Thái,Thời Gian'];
  for (const uid of session.eligible_member_ids) {
    const a = attendedMap.get(uid);
    if (a) {
      const time = new Date(a.checked_in_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
      rows.push(`${a.user_id},"${a.username}",${a.status},"${time}"`);
    } else {
      rows.push(`${uid},,chua_diem_danh,`);
    }
  }

  const csvBuffer = Buffer.from('\uFEFF' + rows.join('\n'), 'utf-8');
  const safeName  = session.session_name.replace(/[^a-z0-9à-ỹ]/gi, '_');
  const fileName  = `diemdanh_${safeName}_${session.id.slice(0, 8)}.csv`;
  const attachment = new AttachmentBuilder(csvBuffer, { name: fileName });

  const embed = new EmbedBuilder()
    .setAuthor(AUTHOR_DEFAULT)
    .setTitle('📄 Xuất Điểm Danh')
    .setColor(0xD4AF37)
    .setDescription(`Phiên: **${session.session_name}**\n${attended.length} bản ghi được xuất.`)
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed], files: [attachment] });
}

module.exports = { data, execute };
