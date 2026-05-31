// handlers/setup/channelRoleHandler.js — setup:channel, setup:role, setup:phai
'use strict';
const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, ChannelSelectMenuBuilder, PermissionFlagsBits,
} = require('discord.js');
const db = require('../../db.js');
const { FOOTER_DEFAULT, AUTHOR_DEFAULT } = require('../../utils/embeds.js');
const { buildDashboard } = require('./dashboardHandler.js');

async function handleChannelRole(interaction) {
  const { customId, guild } = interaction;

  // ── Kênh thông báo ─────────────────────────────────────────────────────────
  if (customId === 'setup:channel') {
    await interaction.deferUpdate();
    const embed = new EmbedBuilder()
      .setAuthor(AUTHOR_DEFAULT)
      .setTitle('🔔 Chọn kênh thông báo')
      .setDescription('Chọn kênh bot sẽ gửi thông báo điểm danh.')
      .setColor(0x5865F2).setFooter({ text: FOOTER_DEFAULT });
    const row = new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId('setup:channel:select')
        .setPlaceholder('Chọn kênh...')
        .setMinValues(1).setMaxValues(1),
    );
    await interaction.editReply({ embeds: [embed], components: [row], ephemeral: true });
    return true;
  }

  if (customId === 'setup:channel:select') {
    await interaction.deferUpdate();
    const channelId = interaction.values[0];
    await db.updateConfig(guild.id, { notification_channel_id: channelId });
    const cfg = await db.getConfig(guild.id);
    const payload = await buildDashboard(guild, cfg, 'admin');
    payload.content = `✅ Đã cài kênh thông báo: <#${channelId}>`;
    await interaction.editReply(payload);
    return true;
  }

  // ── Role điểm danh ─────────────────────────────────────────────────────────
  if (customId === 'setup:role') {
    await interaction.deferUpdate();
    const embed = new EmbedBuilder()
      .setAuthor(AUTHOR_DEFAULT)
      .setTitle('🎫 Cài Role Điểm Danh')
      .setDescription('Chọn role được phép điểm danh. Bỏ trống = tất cả thành viên.')
      .setColor(0x5865F2).setFooter({ text: FOOTER_DEFAULT });
    const roles = [...guild.roles.cache.values()]
      .filter(r => !r.managed && r.id !== guild.id)
      .sort((a, b) => b.position - a.position)
      .slice(0, 25);
    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('setup:role:select')
        .setPlaceholder('Chọn role...')
        .setMinValues(1).setMaxValues(1)
        .addOptions([
          { label: '(Không giới hạn)', value: 'none', description: 'Tất cả thành viên đều điểm danh được' },
          ...roles.map(r => ({ label: r.name, value: r.id, description: `ID: ${r.id}` })),
        ]),
    );
    await interaction.editReply({ embeds: [embed], components: [row], ephemeral: true });
    return true;
  }

  if (customId === 'setup:role:select') {
    await interaction.deferUpdate();
    const roleId = interaction.values[0];
    await db.updateConfig(guild.id, { allowed_role_id: roleId === 'none' ? null : roleId });
    const cfg = await db.getConfig(guild.id);
    const payload = await buildDashboard(guild, cfg, 'admin');
    payload.content = roleId === 'none'
      ? '✅ Đã bỏ giới hạn role điểm danh.'
      : `✅ Đã cài role điểm danh: <@&${roleId}>`;
    await interaction.editReply(payload);
    return true;
  }

  // ── Role phái ──────────────────────────────────────────────────────────────
  if (customId === 'setup:phai') {
    await interaction.deferUpdate();
    const cfg = await db.getConfig(guild.id);
    const currentIds = cfg.phai_role_ids ?? [];
    const roles = [...guild.roles.cache.values()]
      .filter(r => !r.managed && r.id !== guild.id)
      .sort((a, b) => b.position - a.position)
      .slice(0, 25);
    const embed = new EmbedBuilder()
      .setAuthor(AUTHOR_DEFAULT)
      .setTitle('⚔️ Cài Role Phái')
      .setDescription([
        'Chọn **tối đa 10 role** đại diện cho các phái trong guild.',
        currentIds.length
          ? `\n**Hiện tại:** ${currentIds.map(id => `<@&${id}>`).join(', ')}`
          : '\n_Chưa có role phái nào._',
      ].join(''))
      .setColor(0x5865F2).setFooter({ text: FOOTER_DEFAULT });
    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('setup:phai:select')
        .setPlaceholder('Chọn các role phái...')
        .setMinValues(0).setMaxValues(Math.min(10, roles.length))
        .addOptions([
          { label: '(Xóa tất cả)', value: 'none', description: 'Bỏ toàn bộ role phái' },
          ...roles.map(r => ({ label: r.name, value: r.id, description: `ID: ${r.id}` })),
        ]),
    );
    await interaction.editReply({ embeds: [embed], components: [row], ephemeral: true });
    return true;
  }

  if (customId === 'setup:phai:select') {
    await interaction.deferUpdate();
    const selected = interaction.values.filter(v => v !== 'none');
    await db.updateConfig(guild.id, { phai_role_ids: selected });
    const cfg = await db.getConfig(guild.id);
    const payload = await buildDashboard(guild, cfg, 'admin');
    payload.content = selected.length
      ? `✅ Đã cài ${selected.length} role phái.`
      : '✅ Đã xóa tất cả role phái.';
    await interaction.editReply(payload);
    return true;
  }

  return false;
}

module.exports = { handleChannelRole };
