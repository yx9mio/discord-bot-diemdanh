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

  // ── Kênh thông báo ──────────────────────────────────────────────────────────────
  if (customId === 'setup:channel') {
    await interaction.deferUpdate();
    const embed = new EmbedBuilder()
      .setAuthor(AUTHOR_DEFAULT)
      .setTitle('\uD83D\uDD14 Ch\u1ecdn k\u00eanh th\u00f4ng b\u00e1o')
      .setDescription('Ch\u1ecdn k\u00eanh bot s\u1ebd g\u1eedi th\u00f4ng b\u00e1o \u0111i\u1ec3m danh.')
      .setColor(0x5865F2).setFooter({ text: FOOTER_DEFAULT });
    const row = new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId('setup:channel:select')
        .setPlaceholder('Ch\u1ecdn k\u00eanh...')
        .setMinValues(1).setMaxValues(1),
    );
    // NOTE: ephemeral được set trong deferReply trước, không truyền lại \u1edf editReply
    await interaction.editReply({ embeds: [embed], components: [row] });
    return true;
  }

  if (customId === 'setup:channel:select') {
    await interaction.deferUpdate();
    const channelId = interaction.values[0];
    await db.updateConfig(guild.id, { notification_channel_id: channelId });
    const cfg = await db.getConfig(guild.id);
    const payload = await buildDashboard(guild, cfg, 'admin');
    payload.content = `\u2705 \u0110\u00e3 c\u00e0i k\u00eanh th\u00f4ng b\u00e1o: <#${channelId}>`;
    await interaction.editReply(payload);
    return true;
  }

  // ── Role \u0111i\u1ec3m danh ────────────────────────────────────────────────────────────
  if (customId === 'setup:role') {
    await interaction.deferUpdate();
    const embed = new EmbedBuilder()
      .setAuthor(AUTHOR_DEFAULT)
      .setTitle('\uD83C\uDFAB C\u00e0i Role \u0110i\u1ec3m Danh')
      .setDescription('Ch\u1ecdn role \u0111\u01b0\u1ee3c ph\u00e9p \u0111i\u1ec3m danh. B\u1ecf tr\u1ed1ng = t\u1ea5t c\u1ea3 th\u00e0nh vi\u00ean.')
      .setColor(0x5865F2).setFooter({ text: FOOTER_DEFAULT });
    const roles = [...guild.roles.cache.values()]
      .filter(r => !r.managed && r.id !== guild.id)
      .sort((a, b) => b.position - a.position)
      .slice(0, 25);
    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('setup:role:select')
        .setPlaceholder('Ch\u1ecdn role...')
        .setMinValues(1).setMaxValues(1)
        .addOptions([
          { label: '(Kh\u00f4ng gi\u1edbi h\u1ea1n)', value: 'none', description: 'T\u1ea5t c\u1ea3 th\u00e0nh vi\u00ean \u0111\u1ec1u \u0111i\u1ec3m danh \u0111\u01b0\u1ee3c' },
          ...roles.map(r => ({ label: r.name, value: r.id, description: `ID: ${r.id}` })),
        ]),
    );
    await interaction.editReply({ embeds: [embed], components: [row] });
    return true;
  }

  if (customId === 'setup:role:select') {
    await interaction.deferUpdate();
    const roleId = interaction.values[0];
    await db.updateConfig(guild.id, { allowed_role_id: roleId === 'none' ? null : roleId });
    const cfg = await db.getConfig(guild.id);
    const payload = await buildDashboard(guild, cfg, 'admin');
    payload.content = roleId === 'none'
      ? '\u2705 \u0110\u00e3 b\u1ecf gi\u1edbi h\u1ea1n role \u0111i\u1ec3m danh.'
      : `\u2705 \u0110\u00e3 c\u00e0i role \u0111i\u1ec3m danh: <@&${roleId}>`;
    await interaction.editReply(payload);
    return true;
  }

  // ── Role ph\u00e1i ───────────────────────────────────────────────────────────────
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
      .setTitle('\u2694\uFE0F C\u00e0i Role Ph\u00e1i')
      .setDescription([
        'Ch\u1ecdn **t\u1ed1i \u0111a 10 role** \u0111\u1ea1i di\u1ec7n cho c\u00e1c ph\u00e1i trong guild.',
        currentIds.length
          ? `\n**Hi\u1ec7n t\u1ea1i:** ${currentIds.map(id => `<@&${id}>`).join(', ')}`
          : '\n_Ch\u01b0a c\u00f3 role ph\u00e1i n\u00e0o._',
      ].join(''))
      .setColor(0x5865F2).setFooter({ text: FOOTER_DEFAULT });
    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('setup:phai:select')
        .setPlaceholder('Ch\u1ecdn c\u00e1c role ph\u00e1i...')
        .setMinValues(0).setMaxValues(Math.min(10, roles.length))
        .addOptions([
          { label: '(X\u00f3a t\u1ea5t c\u1ea3)', value: 'none', description: 'B\u1ecf to\u00e0n b\u1ed9 role ph\u00e1i' },
          ...roles.map(r => ({ label: r.name, value: r.id, description: `ID: ${r.id}` })),
        ]),
    );
    await interaction.editReply({ embeds: [embed], components: [row] });
    return true;
  }

  if (customId === 'setup:phai:select') {
    await interaction.deferUpdate();
    const selected = interaction.values.filter(v => v !== 'none');
    await db.updateConfig(guild.id, { phai_role_ids: selected });
    const cfg = await db.getConfig(guild.id);
    const payload = await buildDashboard(guild, cfg, 'admin');
    payload.content = selected.length
      ? `\u2705 \u0110\u00e3 c\u00e0i ${selected.length} role ph\u00e1i.`
      : '\u2705 \u0110\u00e3 x\u00f3a t\u1ea5t c\u1ea3 role ph\u00e1i.';
    await interaction.editReply(payload);
    return true;
  }

  return false;
}

module.exports = { handleChannelRole };
