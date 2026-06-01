'use strict';
const { Command } = require('@sapphire/framework');

// ── Logic gốc (giữ nguyên 100%) ──────────────────────────────────────────────
// commands/broadcast.js — Ping những người chưa điểm danh (Admin)
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../db.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('broadcast')
    .setDescription('Ping những người chưa điểm danh (chỉ Admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o =>
      o.setName('tin_nhan').setDescription('Nội dung nhắc nhở (tùy chọn)').setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guild } = interaction;
    const session = await db.getActiveSession(guild.id);
    if (!session) return interaction.editReply({ content: '⚠️ Không có phiên nào đang mở.' });

    const attendances = await db.getAttendances(session.id);
    const presentIds  = new Set(attendances.map(a => a.user_id));

    const eligible = session.eligible_member_ids?.length ? session.eligible_member_ids : null;
    await guild.members.fetch();
    const absentMembers = guild.members.cache.filter(m =>
      !m.user.bot &&
      !presentIds.has(m.id) &&
      (!eligible || eligible.includes(m.id))
    );

    if (!absentMembers.size)
      return interaction.editReply({ content: '✅ Tất cả đã điểm danh!' });

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
  },
};
// ── Sapphire wrapper ──────────────────────────────────────────────────────────
const _origModule = module.exports; // has { data, execute }

class BroadcastCommand extends Command {
  constructor(context) {
    super(context, { name: _origModule.data.name, description: _origModule.data.description, preconditions: ['AdminOnly'] });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand(_origModule.data);
  }

  async chatInputRun(interaction) {
    return _origModule.execute(interaction);
  }
}

module.exports = { BroadcastCommand };
