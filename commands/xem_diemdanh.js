// commands/xem_diemdanh.js — Xem phiên hiện tại + nút điểm danh trực tiếp
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../db.js');
const { buildSessionEmbed } = require('../utils/embeds.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('xem_diemdanh')
    .setDescription('Xem phiên điểm danh hiện tại và điểm danh ngay tại đây'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guild, user } = interaction;

    const session = await db.getActiveSession(guild.id);
    if (!session) {
      return interaction.editReply({ content: '🚫 Không có phiên điểm danh nào đang mở.' });
    }

    const attended  = await db.getAttendances(session.id);
    const myRecord  = attended.find(a => a.user_id === user.id);
    const embed     = await buildSessionEmbed(guild, session, attended);

    // Status hiện tại của user
    const STATUS_LABEL = {
      tham_gia:       '✅ Tham Gia',
      tre:            '⏰ Đến Trễ',
      khong_tham_gia: '❌ Vắng Mặt',
    };
    const statusNote = myRecord
      ? `\n\n📌 **Trạng thái của bạn: ${STATUS_LABEL[myRecord.status] ?? myRecord.status}** — Dùng nút bên dưới để đổi.`
      : '\n\n⚡ Bạn **chưa điểm danh** — Hãy bấm nút bên dưới!';
    embed.setDescription((embed.data.description ?? '') + statusNote);

    // Row nút điểm danh ngay trong reply
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('attend_yes')
        .setLabel('✅ Tham Gia')
        .setStyle(myRecord?.status === 'tham_gia' ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('attend_late')
        .setLabel('⏰ Đến Trễ')
        .setStyle(myRecord?.status === 'tre' ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('attend_no')
        .setLabel('❌ Vắng Mặt')
        .setStyle(myRecord?.status === 'khong_tham_gia' ? ButtonStyle.Danger : ButtonStyle.Secondary),
    );

    return interaction.editReply({ embeds: [embed], components: [row] });
  },
};
