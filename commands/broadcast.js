// commands/broadcast.js — Ping những người chưa điểm danh (Admin)
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const db = require('../db.js');
const { laAdmin } = require('../utils/helpers.js');
const { FOOTER_DEFAULT, AUTHOR_DEFAULT } = require('../utils/embeds.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('broadcast')
    .setDescription('[Admin] Ping những thành viên chưa điểm danh trong phiên hiện tại')
    .addChannelOption(o =>
      o.setName('kenh')
        .setDescription('Kênh gửi thông báo (mặc định: kênh hiện tại)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false))
    .addStringOption(o =>
      o.setName('tin_nhan')
        .setDescription('Tin nhắn tùy chỉnh gửi kèm (tùy chọn)')
        .setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guild, member } = interaction;

    const cfg = await db.getConfig(guild.id);
    if (!laAdmin(member, cfg)) {
      return interaction.editReply({ content: '🔒 Bạn cần quyền Admin hoặc role Admin Bot để dùng lệnh này.' });
    }

    const session = await db.getActiveSession(guild.id);
    if (!session) {
      return interaction.editReply({ content: '🚫 Không có phiên điểm danh nào đang mở.' });
    }

    const attended  = await db.getAttendances(session.id);
    const checkedIds = new Set(attended.map(a => a.user_id));
    const absentIds  = (session.eligible_member_ids ?? []).filter(id => !checkedIds.has(id));

    if (absentIds.length === 0) {
      return interaction.editReply({ content: '✅ Tất cả thành viên đã điểm danh rồi!' });
    }

    const targetChannel = interaction.options.getChannel('kenh') ?? interaction.channel;
    const customMsg     = interaction.options.getString('tin_nhan');

    const MAX_PING = 30;
    const mentions = absentIds.slice(0, MAX_PING).map(id => `<@${id}>`);
    const extra    = absentIds.length > MAX_PING ? `\n*(+${absentIds.length - MAX_PING} thành viên khác không hiện)*` : '';

    const embed = new EmbedBuilder()
      .setAuthor(AUTHOR_DEFAULT)
      .setTitle(`📢 Nhắc Điểm Danh — ${session.session_name}`)
      .setColor(0xFEE75C)
      .setDescription([
        `⏳ **${absentIds.length} thành viên** chưa điểm danh phiên **${session.session_name}**.`,
        customMsg ? `\n💬 ${customMsg}` : '',
        '',
        mentions.join(' ') + extra,
      ].filter(s => s !== null).join('\n'))
      .setFooter({ text: `${FOOTER_DEFAULT} · Hãy bấm nút điểm danh trong kênh phiên` })
      .setTimestamp();

    await targetChannel.send({ embeds: [embed] });
    return interaction.editReply({
      content: `✅ Đã gửi nhắc điểm danh cho **${Math.min(absentIds.length, MAX_PING)} thành viên** vào <#${targetChannel.id}>.`,
    });
  },
};
