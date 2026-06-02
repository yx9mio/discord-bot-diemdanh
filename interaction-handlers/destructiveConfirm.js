// interaction-handlers/destructiveConfirm.js
// Handles: xoa:confirm:<uid>, resetstreak:confirm:<uid>, huy:confirm:<sid>, caidat:reset:confirm
//          xoa:cancel:<uid>, resetstreak:cancel:<uid>, huy:cancel:<sid>, caidat:reset:cancel
'use strict';
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const { EmbedBuilder } = require('discord.js');
const db = require('../db.js');
const log = require('../utils/logger.js');

const CONFIRM_PREFIXES = {
  'xoa:confirm':          handleXoaConfirm,
  'resetstreak:confirm':  handleResetStreakConfirm,
  'huy:confirm':          handleHuyConfirm,
  'caidat:reset:confirm': handleCaidatResetConfirm,
  'lichcd:delall:confirm': handleLichcdDelAllConfirm,
};

const CANCEL_PREFIXES = ['xoa:cancel', 'resetstreak:cancel', 'huy:cancel', 'caidat:reset:cancel', 'lichcd:delall:cancel'];

function matchPrefix(prefixes, customId) {
  for (const p of prefixes) {
    if (customId?.startsWith(p + ':') || customId === p) return p;
  }
  return null;
}

class DestructiveConfirmHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    if (matchPrefix(Object.keys(CONFIRM_PREFIXES), interaction.customId)) return this.some();
    if (matchPrefix(CANCEL_PREFIXES, interaction.customId)) return this.some();
    return this.none();
  }

  async run(interaction) {
    const cancelP = matchPrefix(CANCEL_PREFIXES, interaction.customId);
    if (cancelP) {
      await interaction.update({ content: '↩️ Đã hủy.', embeds: [], components: [] });
      return;
    }
    const confirmP = matchPrefix(Object.keys(CONFIRM_PREFIXES), interaction.customId);
    if (!confirmP) return;
    const fn = CONFIRM_PREFIXES[confirmP];
    await fn(interaction, this.container);
  }
}

async function handleXoaConfirm(interaction) {
  const { guild, customId } = interaction;
  const targetId = customId.split(':')[2];
  if (!targetId) return;

  await interaction.deferUpdate();
  try {
    await db.deleteMember(guild.id, targetId);
  } catch (e) {
    log.error('XOATHANHVIEN', guild.id, 'deleteMember thất bại %s: %s', targetId, e.message);
    return interaction.editReply({ content: '❌ Không thể xóa, thử lại sau.', embeds: [], components: [] });
  }
  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setDescription(`✅ Đã xóa <@${targetId}> khỏi danh sách.`)
    .setTimestamp();
  return interaction.editReply({ embeds: [embed], components: [] });
}

async function handleResetStreakConfirm(interaction) {
  const { guild, customId } = interaction;
  const targetId = customId.split(':')[2];
  if (!targetId) return;

  await interaction.deferUpdate();
  try {
    await db.resetStreak(guild.id, targetId);
  } catch (e) {
    log.error('RESETSTREAK', guild.id, 'resetStreak thất bại %s: %s', targetId, e.message);
    return interaction.editReply({ content: '❌ Không thể reset streak, thử lại sau.', embeds: [], components: [] });
  }
  const embed = new EmbedBuilder()
    .setColor(0xfee75c)
    .setDescription(`🔄 Streak của <@${targetId}> đã được đặt về 0.`)
    .setTimestamp();
  return interaction.editReply({ embeds: [embed], components: [] });
}

async function handleHuyConfirm(interaction) {
  const { guild, customId } = interaction;
  const sessionId = customId.split(':')[2];
  if (!sessionId) return;

  await interaction.deferUpdate();
  const session = await db.getSessionById(sessionId);
  if (!session) return interaction.editReply({ content: '⚠️ Phiên không tồn tại hoặc đã đóng.', embeds: [], components: [] });

  try {
    await db.cancelSession(session.id);
  } catch (e) {
    log.error('HUYPHIEN', guild.id, 'cancelSession thất bại %s: %s', sessionId, e.message);
    return interaction.editReply({ content: '❌ Không thể hủy phiên, thử lại sau.', embeds: [], components: [] });
  }

  const embed = new EmbedBuilder()
    .setColor(0xa12c7b)
    .setTitle('🚫 Phiên đã bị hủy')
    .setDescription(`Phiên **${session.session_name}** đã bị hủy bởi <@${interaction.user.id}>.`)
    .setTimestamp();

  if (session.message_id && session.channel_id) {
    const ch = guild.channels.cache.get(session.channel_id);
    if (ch) {
      const msg = await ch.messages.fetch(session.message_id).catch(() => null);
      if (msg) await msg.edit({ embeds: [embed], components: [] }).catch(() => null);
    }
  }
  return interaction.editReply({ embeds: [embed], components: [] });
}

async function handleCaidatResetConfirm(interaction) {
  const { guild } = interaction;
  await interaction.deferUpdate();
  try {
    await db.setGuildConfig(guild.id, {
      log_channel_id: null,
      timezone: 'Asia/Ho_Chi_Minh',
      phai_role_ids: [],
      schedules: [],
    });
  } catch (e) {
    log.error('CAIDATRESET', guild.id, 'reset thất bại: %s', e.message);
    return interaction.editReply({ content: '❌ Không thể reset, thử lại sau.', embeds: [], components: [] });
  }
  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setDescription('✅ Đã reset cài đặt về mặc định.')
    .setTimestamp();
  return interaction.editReply({ embeds: [embed], components: [] });
}

async function handleLichcdDelAllConfirm(interaction) {
  const { guild } = interaction;
  await interaction.deferUpdate();
  try {
    await db.setGuildConfig(guild.id, { schedules: [] });
  } catch (e) {
    log.error('LICHDDELALL', guild.id, 'delete-all-schedules thất bại: %s', e.message);
    return interaction.editReply({ content: '❌ Không thể xóa, thử lại sau.', embeds: [], components: [] });
  }
  const { buildLichcdEmbed, buildScheduleDeleteRows } = require('../src/commands/schedule/lichcodinh.js');
  const cfg = await db.getGuildConfig(guild.id);
  const embed = buildLichcdEmbed([], cfg.auto_schedule_enabled);
  const rows  = buildScheduleDeleteRows([]);
  return interaction.editReply({ embeds: [embed], components: rows });
}

module.exports = { DestructiveConfirmHandler };
