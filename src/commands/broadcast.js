// src/commands/broadcast.js
'use strict';
const { Command } = require('@sapphire/framework');
const { PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('../../db.js');

class BroadcastCommand extends Command {
  constructor(context) {
    super(context, { name: 'broadcast', description: 'Ping những người chưa điểm danh', preconditions: ['AdminOnly'] });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand(builder =>
      builder
        .setName('broadcast')
        .setDescription('Ping những người chưa điểm danh (chỉ Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addStringOption(o =>
          o.setName('tin_nhan').setDescription('Nội dung nhắc nhở (tùy chọn)').setRequired(false)
        )
    );
  }

  async chatInputRun(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const { guild } = interaction;
    const session = await db.getActiveSession(guild.id);
    if (!session) return interaction.editReply({ content: '⚠️ Không có phiên nào đang mở.' });

    const attendances = await db.getAttendances(session.id);
    const presentIds  = new Set(attendances.map(a => a.user_id));
    const eligible    = session.eligible_member_ids?.length ? session.eligible_member_ids : null;

    await guild.members.fetch();
    const absentMembers = guild.members.cache.filter(m =>
      !m.user.bot && !presentIds.has(m.id) && (!eligible || eligible.includes(m.id))
    );

    if (!absentMembers.size) return interaction.editReply({ content: '✅ Tất cả đã điểm danh!' });

    const msg  = interaction.options.getString('tin_nhan') ?? 'Bạn chưa điểm danh! Vui lòng sử dụng /diemdanh.';
    const tags = absentMembers.map(m => m.toString()).join(' ');
    const embed = new EmbedBuilder()
      .setColor(0xda7101)
      .setTitle('📢 Nhắc nhở điểm danh')
      .setDescription(`${tags}\n\n${msg}`)
      .setFooter({ text: `Phiên: ${session.session_name}` })
      .setTimestamp();

    await interaction.channel.send({ embeds: [embed] });
    await interaction.editReply({ content: `✅ Đã ping ${absentMembers.size} thành viên chưa điểm danh.` });
  }
}

module.exports = { BroadcastCommand };
