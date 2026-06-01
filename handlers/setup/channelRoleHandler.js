// handlers/setup/channelRoleHandler.js — setup:channel, setup:role, setup:phai
'use strict';
const {
  ActionRowBuilder,
  StringSelectMenuBuilder, ChannelSelectMenuBuilder,
} = require('discord.js');
const db = require('../../db.js');
const { buildDashboard }  = require('./dashboardHandler.js');
const log = require('../../utils/logger.js');

// ─── Setup: Channel ────────────────────────────────────────────────────────────
async function handleChannel(interaction) {
  const { customId, guild } = interaction;

  if (customId === 'setup:channel:select') {
    const channelId = interaction.values[0];
    await db.upsertConfig(guild.id, { channel_id: channelId });
    await interaction.update({ content: null });
    const dash = await buildDashboard(guild);
    await interaction.editReply(dash);
    return true;
  }

  if (customId === 'setup:channel:open') {
    const row = new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId('setup:channel:select')
        .setPlaceholder('Chọn kênh điểm danh…')
        .setChannelTypes(0),
    );
    await interaction.update({ content: '📌 Chọn kênh điểm danh:', components: [row] });
    return true;
  }

  return false;
}

// ─── Setup: Role ───────────────────────────────────────────────────────────────
async function handleRole(interaction) {
  const { customId, guild } = interaction;

  if (customId === 'setup:role:select') {
    const roleId = interaction.values[0];
    await db.upsertConfig(guild.id, { allowed_role_id: roleId });
    await interaction.update({ content: null });
    const dash = await buildDashboard(guild);
    await interaction.editReply(dash);
    return true;
  }

  if (customId === 'setup:role:clear') {
    await db.upsertConfig(guild.id, { allowed_role_id: null });
    await interaction.update({ content: null });
    const dash = await buildDashboard(guild);
    await interaction.editReply(dash);
    return true;
  }

  if (customId === 'setup:role:open') {
    const roles = guild.roles.cache
      .filter(r => !r.managed && r.id !== guild.id)
      .sort((a, b) => b.position - a.position)
      .first(25);

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('setup:role:select')
        .setPlaceholder('Chọn role được điểm danh…')
        .addOptions(roles.map(r => ({ label: r.name, value: r.id }))),
    );
    await interaction.update({ content: '🎭 Chọn role:', components: [row] });
    return true;
  }

  return false;
}

// ─── Setup: Phái ──────────────────────────────────────────────────────────────
async function handlePhai(interaction) {
  const { customId, guild } = interaction;

  if (customId !== 'setup:phai:save') return false;

  const selectedRoles = interaction.values ?? [];
  try {
    await db.upsertConfig(guild.id, { phai_role_ids: selectedRoles });
  } catch (e) {
    log.error('CHANNEL_ROLE', guild.id, 'Lưu phai_role_ids thất bại: %s', e.message);
  }
  await interaction.update({ content: null });
  const dash = await buildDashboard(guild);
  await interaction.editReply(dash);
  return true;
}

module.exports = { handleChannel, handleRole, handlePhai };
