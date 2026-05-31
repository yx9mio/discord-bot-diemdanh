// commands/diemdanh.js — Lệnh điểm danh trực tiếp bằng slash command
const { SlashCommandBuilder } = require('discord.js');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../db.js');
const { layHuyHieu } = require('../utils/helpers.js');
const { pctColor, pctEmoji, FOOTER_DEFAULT, AUTHOR_DEFAULT } = require('../utils/embeds.js');
const { buildProgressBar } = require('../utils/progress.js');

const STATUS_MAP = {
  'tham_gia':       { label: '✅ Tham Gia',   color: 0x57F287, verb: 'đã ghi nhận tham gia' },
  'tre':            { label: '⏰ Đến Trễ',    color: 0xFEE75C, verb: 'đã ghi nhận đến trễ' },
  'khong_tham_gia': { label: '❌ Vắng Mặt',   color: 0xED4245, verb: 'đã ghi nhận vắng mặt' },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('diemdanh')
    .setDescription('Điểm danh phiên đang mở bằng slash command')
    .addStringOption(o =>
      o.setName('trang_thai')
        .setDescription('Trạng thái tham gia của bạn')
        .setRequired(true)
        .addChoices(
          { name: '✅ Tham Gia',  value: 'tham_gia' },
          { name: '⏰ Đến Trễ',  value: 'tre' },
          { name: '❌ Vắng Mặt', value: 'khong_tham_gia' },
        )),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guild, member, user } = interaction;
    const status = interaction.options.getString('trang_thai');
    const info   = STATUS_MAP[status];

    const session = await db.getActiveSession(guild.id);
    if (!session) {
      return interaction.editReply({ content: '🚫 Không có phiên điểm danh nào đang mở.' });
    }

    // Kiểm tra eligible
    if (session.eligible_member_ids?.length > 0 && !session.eligible_member_ids.includes(user.id)) {
      return interaction.editReply({ content: '⚠️ Bạn không nằm trong danh sách điểm danh của phiên này.' });
    }

    // Kiểm tra role
    if (session.allowed_role_id && !member.roles.cache.has(session.allowed_role_id)) {
      const roleName = guild.roles.cache.get(session.allowed_role_id)?.name ?? 'role cần thiết';
      return interaction.editReply({ content: `🔒 Bạn cần role **${roleName}** để điểm danh.` });
    }

    // Kiểm tra đã điểm danh chưa
    const existing = (await db.getAttendances(session.id)).find(a => a.user_id === user.id);
    const isUpdate = !!existing;

    const displayName = member.nickname ?? user.globalName ?? user.username;
    await db.upsertAttendance(session.id, guild.id, user.id, displayName, status);

    // Lấy stats sau khi upsert
    const stats = await db.getMemberStats(guild.id, user.id).catch(() => null);
    const totalJoined = stats?.total_joined ?? 0;
    const totalSessions = stats?.total_sessions ?? 1;
    const pct = totalSessions > 0 ? Math.round((totalJoined / totalSessions) * 100) : 0;
    const bar = buildProgressBar(pct);
    const badge = layHuyHieu(totalJoined);

    const embed = new EmbedBuilder()
      .setAuthor(AUTHOR_DEFAULT)
      .setTitle(`${info.label} — ${isUpdate ? 'Cập nhật điểm danh' : 'Điểm danh thành công'}`)
      .setColor(info.color)
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .setDescription([
        `**${displayName}** ${info.verb} phiên **${session.session_name}**.`,
        '',
        `${pctEmoji(pct)} \`${bar}\` **${pct}%** tổng thể (${totalJoined}/${totalSessions})`,
        badge ? `🏅 Huy hiệu: ${badge}` : '',
        `🔥 Streak: **${stats?.current_streak ?? 0}** phiên liên tiếp`,
      ].filter(Boolean).join('\n'))
      .addFields(
        { name: '📅 Phiên', value: session.session_name, inline: true },
        { name: '⏰ Trạng thái', value: info.label, inline: true },
        { name: isUpdate ? '♻️ Hành động' : '✨ Hành động', value: isUpdate ? 'Đã cập nhật' : 'Ghi mới', inline: true },
      )
      .setFooter({ text: `${FOOTER_DEFAULT} · Dùng lại lệnh để đổi trạng thái` })
      .setTimestamp();

    // Cập nhật embed phiên gốc
    try {
      const ch = guild.channels.cache.get(session.channel_id);
      if (ch && session.message_id) {
        const msg = await ch.messages.fetch(session.message_id).catch(() => null);
        if (msg) {
          const attended = await db.getAttendances(session.id);
          const { buildSessionEmbed } = require('./utils/embeds.js');
          const sessionEmbed = await buildSessionEmbed(guild, session, attended);
          await msg.edit({ embeds: [sessionEmbed] }).catch(() => null);
        }
      }
    } catch (_) { /* silent */ }

    return interaction.editReply({ embeds: [embed] });
  },
};
