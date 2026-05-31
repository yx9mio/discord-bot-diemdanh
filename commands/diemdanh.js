// commands/diemdanh.js — Điểm danh bằng slash command (ephemeral)
const { SlashCommandBuilder } = require('discord.js');
const { EmbedBuilder } = require('discord.js');
const db = require('../db.js');
const { buildSessionEmbed, FOOTER_DEFAULT, AUTHOR_DEFAULT } = require('../utils/embeds.js');

const STATUS_MAP = {
  'tham_gia':       { label: '✅ Tham Gia',  color: 0x57F287 },
  'tre':            { label: '⏰ Đến Trễ',   color: 0xFEE75C },
  'khong_tham_gia': { label: '❌ Vắng Mặt', color: 0xED4245 },
};

const data = new SlashCommandBuilder()
  .setName('diem_danh')
  .setDescription('Điểm danh tham gia / trễ / vắng mặt cho phiên đang mở')
  .addStringOption(opt =>
    opt.setName('trang_thai')
      .setDescription('Chọn trạng thái điểm danh')
      .setRequired(true)
      .addChoices(
        { name: '✅ Tham Gia',  value: 'tham_gia' },
        { name: '⏰ Đến Trễ',   value: 'tre' },
        { name: '❌ Vắng Mặt', value: 'khong_tham_gia' },
      )
  );

async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const { guild, member, user } = interaction;
  const status = interaction.options.getString('trang_thai');

  const session = await db.getActiveSession(guild.id);
  if (!session) {
    return interaction.editReply({ content: '📭 Không có phiên điểm danh nào đang mở.' });
  }

  // Kiểm tra eligible
  if (session.eligible_member_ids && !session.eligible_member_ids.includes(user.id)) {
    return interaction.editReply({ content: '⚠️ Bạn không nằm trong danh sách điểm danh phiên này.' });
  }

  // Kiểm tra role
  if (session.allowed_role_id && !member.roles.cache.has(session.allowed_role_id)) {
    const roleName = guild.roles.cache.get(session.allowed_role_id)?.name ?? 'role cần thiết';
    return interaction.editReply({ content: `🔒 Bạn cần có role **${roleName}** để điểm danh.` });
  }

  const displayName = member.nickname ?? user.globalName ?? user.username;
  const isUpdate = (await db.getAttendances(session.id)).some(a => a.user_id === user.id);
  await db.upsertAttendance(session.id, guild.id, user.id, displayName, status);

  // Cập nhật embed phiên gốc
  try {
    const ch = guild.channels.cache.get(session.channel_id);
    if (ch && session.message_id) {
      const msg = await ch.messages.fetch(session.message_id).catch(() => null);
      if (msg) {
        const attended = await db.getAttendances(session.id);
        const embed    = await buildSessionEmbed(guild, session, attended);
        await msg.edit({ embeds: [embed] }).catch(() => null);
      }
    }
  } catch (_) { /* silent */ }

  const info = STATUS_MAP[status];
  const verb = isUpdate ? 'Cập nhật' : 'Đã ghi nhận';
  const embed = new EmbedBuilder()
    .setAuthor(AUTHOR_DEFAULT)
    .setTitle(`${info.label}`)
    .setDescription(`${verb} điểm danh **${info.label}** cho bạn trong phiên:\n**${session.session_name}**`)
    .setColor(info.color)
    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
    .addFields(
      { name: '👤 Thành viên', value: displayName, inline: true },
      { name: '🗓️ Phiên', value: session.session_name, inline: true },
      { name: '💡 Tip', value: isUpdate ? 'Trạng thái đã được cập nhật.' : 'Bạn có thể đổi lại bằng cách gọi lệnh này lần nữa.', inline: false },
    )
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();

  return interaction.editReply({ embeds: [embed] });
}

module.exports = { data, execute };
